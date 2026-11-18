-- רחוב טוב במספרים, 18.11.2026: רחובות שנשמטו (למשל רוגוזין).
-- 1. רחוב בלי גאומטריה ב-cl_streets, או עם קטע קצר מ-40 מ', מקבל גאומטריה מדרכי OSM לפי שם מנורמל (rn_nn).
-- 2. רחוב שאין לו גאומטריה גם אחרי זה נשמר ב-rn_street_metrics עם סיבה (geo = nogeometry / short), ולא נעלם.
-- 3. התאמת שם לדרכי OSM (סוג דרך, צמתים) נעשית לפי שם מנורמל: שד' / שדרות, גרשיים, מקפים, ו"ה" הידיעה (דוכיפת / הדוכיפת).
-- 4. כשיש מיקום רשמי, קו OSM מתקבל רק אם הוא עד 250 מ' ממנו (אחרת רחוב אחר באותו שם: "השקמה").
create or replace function public.rn_nn(t text) returns text language sql immutable set search_path = public as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(t,''), '[''"״׳`’־\-\.,]', ' ', 'g'), '^(שד|שדרות|דרך|רח|רחוב)\s+', ''), '(^|\s)ה', '\1', 'g'), '\s+', '', 'g')
$$;

-- (גרסה 18.11.2026) רחוב טוב במספרים: חישוב המדדים לכל רחוב באשדוד (ASHDODMAP, cbhexpybdggwzyakgagd).
-- קלט: cl_streets (רשימת הרחובות הארצית מותאמת ל-OSM), rn_osm (שכבות OSM, נטענות ב-rn_fetch_osm),
-- rn_street_quarter (שיוך עירוני מ-NiceStreets), mt_existing (מוסדות חינוך), plan_projects + shchuna_plan_scores, votes.
-- פלט: rn_street_metrics. הטלה: רשת ישראל החדשה (EPSG:2039), במטרים.
--
-- איכות גאומטריה (05.11.2026): שם רחוב הותאם לפעמים לכמה רחובות באותו שם בעיר (למשל "האשל").
-- מרכז כל רובע נגזר מהרחובות שהעירייה שייכה אליו ושיש להם אשכול קטעים אחד. לכל רחוב נשמר האשכול הקרוב
-- למרכז הרובע שלו. רחוב שהאשכול הקרוב שלו רחוק מ-1,500 מ' מהמרכז מסומן outside ולא מדורג.
-- רחוב בלי שיוך עירוני משויך לרובע שמרכזו הקרוב ביותר, עד 1,200 מ' (quarter_source = 'location').
create or replace function public.rn_compute()
returns int language plpgsql security definer set search_path = public, extensions as $$
declare n int; k int;
begin
  drop table if exists _rn_o;
  create temp table _rn_o as select kind, osm_id, tags, ST_Transform(geom,2039) g,
    case when tags->>'name' is null then null else rn_nn(tags->>'name') end k from rn_osm where geom is not null;
  create index on _rn_o using gist(g);
  create index on _rn_o (k);

  drop table if exists _rn_st;
  create temp table _rn_st as
  select s.code, s.name, s.osm_name,
    ST_Transform(ST_SetSRID(ST_Collect(ARRAY(
      select ST_MakeLine(ARRAY(select ST_MakePoint((pt->>1)::float, (pt->>0)::float) from jsonb_array_elements(ln) pt))
      from jsonb_array_elements(s.lines) ln where jsonb_array_length(ln) >= 2)),4326),2039) g,
    q.quarter_id, case when q.quarter_id is not null then 'municipal' end as qsrc, null::text as flag, null::text as gsrc,
    rn_nn(s.name) as nk1, rn_nn(coalesce(s.osm_name,'~')) as nk2
  from cl_streets s left join rn_street_quarter q on q.code = s.code
  where s.kind = 'street';

  -- השלמה מ-OSM: אין גאומטריה, או הקטע קצר מ-40 מ'
  drop table if exists _rn_nm;
  create temp table _rn_nm as
  select st.code, ST_Collect(o.g) g
  from _rn_st st join _rn_o o on o.kind = 'road' and (o.k = st.nk1 or o.k = st.nk2)
    and o.tags->>'highway' in ('primary','secondary','tertiary','residential','living_street','unclassified','pedestrian','trunk','primary_link','secondary_link','tertiary_link','service','footway','path')
  where o.k <> '' group by st.code;
  update _rn_st st set g = nm.g, gsrc = 'osm'
  from _rn_nm nm where nm.code = st.code
    and (st.g is null or ST_IsEmpty(st.g) or ST_Length(st.g) < 40)
    and ST_Length(nm.g) > coalesce(ST_Length(st.g), 0)
    and (st.g is null or ST_IsEmpty(st.g) or ST_DWithin(st.g, nm.g, 250));

  -- רחוב שנשאר בלי קו ראוי: נשמר עם סיבה
  drop table if exists _rn_skip;
  create temp table _rn_skip as
  select code, name, quarter_id, qsrc,
    case when g is null or ST_IsEmpty(g) then 'nogeometry' else 'short' end reason,
    case when g is null or ST_IsEmpty(g) then 0 else round(ST_Length(g)::numeric) end len
  from _rn_st where g is null or ST_IsEmpty(g) or ST_Length(g) < 40;
  delete from _rn_st where g is null or ST_IsEmpty(g) or ST_Length(g) < 40;

  -- אשכולות קטעים לכל רחוב (DBSCAN, 200 מ')
  drop table if exists _rn_cl;
  create temp table _rn_cl as
  select code, cid, ST_Multi(ST_Collect(pg)) cg, sum(ST_Length(pg)) len, ST_Centroid(ST_Collect(pg)) c
  from (select code, pg, ST_ClusterDBSCAN(pg, 200, 1) over (partition by code) cid
        from (select st.code, (ST_Dump(st.g)).geom pg from _rn_st st) p) x
  group by code, cid;

  -- מרכז כל רובע: חציון מרכזי הרחובות העירוניים שיש להם אשכול אחד
  drop table if exists _rn_qc;
  create temp table _rn_qc as
  select st.quarter_id, ST_SetSRID(ST_MakePoint(
      percentile_cont(0.5) within group (order by ST_X(c.c)),
      percentile_cont(0.5) within group (order by ST_Y(c.c))), 2039) c, count(*) n
  from _rn_st st join _rn_cl c on c.code = st.code
  where st.quarter_id is not null and (select count(*) from _rn_cl c2 where c2.code = st.code) = 1
  group by st.quarter_id having count(*) >= 2;

  -- רחוב בלי שיוך: הרובע הקרוב (רק רבעי מגורים ואזורים, בלי צירים חוצי עיר)
  update _rn_st st set quarter_id = x.quarter_id, qsrc = 'location'
  from (select distinct on (c.code) c.code, qc.quarter_id
        from _rn_cl c join _rn_st s on s.code = c.code and s.quarter_id is null
        cross join _rn_qc qc
        where qc.quarter_id <> 'q-main-axis' and ST_DWithin(qc.c, c.c, 1200)
        order by c.code, ST_Distance(qc.c, c.c)) x
  where x.code = st.code;

  -- בחירת האשכול: הקרוב למרכז הרובע, או הארוך כשאין מרכז
  update _rn_st st set g = pick.cg,
    flag = case when pick.dist > 1500 and st.quarter_id <> 'q-main-axis' then 'outside' when pick.ncl > 1 then 'trimmed' end
  from (
    select distinct on (c.code) c.code, c.cg, count(*) over (partition by c.code) ncl,
      case when qc.c is null then 0 else ST_Distance(qc.c, c.c) end dist
    from _rn_cl c join _rn_st s on s.code = c.code left join _rn_qc qc on qc.quarter_id = s.quarter_id
    order by c.code, case when qc.c is null or s.quarter_id = 'q-main-axis' then -c.len else ST_Distance(qc.c, c.c) end
  ) pick where pick.code = st.code;
  create index on _rn_st using gist(g);

  drop table if exists _rn_edu;
  create temp table _rn_edu as select subtype, ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(geom::text),4326),2039) g
    from mt_existing where geom->>'type'='Point' and jsonb_array_length(geom->'coordinates')=2;
  create index on _rn_edu using gist(g);

  drop table if exists _rn_plan;
  create temp table _rn_plan as
  select p.id, p.title, p.status, p.plan_number,
    ST_Transform(ST_SetSRID(ST_CollectionExtract(ST_Collect(ARRAY(select ST_GeomFromGeoJSON(f->'geometry') from jsonb_array_elements(p.geojson->'features') f where f->'geometry' is not null)),3),4326),2039) g,
    (select round(sum(least(greatest(coalesce((sc.metrics->(i::text)->>'score')::numeric,0),0), mx)))
       from unnest(array[2,2,4,2,2,3,2,3,3,5,2,4,4,3,4,3,1,7,2,1,3,4,4,2,5,1,2,2,6,3,1,2,1,1,1,3,5,2,2,2,3,1,2,3]) with ordinality as u(mx,i)) pts,
    sc.metrics
  from plan_projects p left join shchuna_plan_scores sc on sc.plan_project_id = p.id
  where p.geojson ? 'features';

  delete from rn_street_metrics;
  insert into rn_street_metrics(code, name, quarter_id, quarter_source, line, m)
  select st.code, st.name, st.quarter_id, st.qsrc,
    (ST_AsGeoJSON(ST_Transform(st.g,4326),5)::jsonb->'coordinates'),
    jsonb_strip_nulls(jsonb_build_object(
      'geo', st.flag,
      'geosrc', st.gsrc,
      'len', round(ST_Length(st.g)::numeric),
      'junctions', jn.c,
      'block', case when jn.c >= 2 then round(ST_Length(st.g)::numeric / (jn.c - 1)) else round(ST_Length(st.g)::numeric) end,
      'bld100', round((b.c::numeric / 2) / (ST_Length(st.g)::numeric/100), 2),
      'levels', b.lv, 'levels_n', b.lvn,
      'shop100', round(sh.c::numeric / (ST_Length(st.g)::numeric/100), 2),
      'cross100', round(cr.c::numeric / (ST_Length(st.g)::numeric/100), 2),
      'bench100', round(be.c::numeric / (ST_Length(st.g)::numeric/100), 2),
      'tree100', round(tr.c::numeric / (ST_Length(st.g)::numeric/100), 2),
      'lamp100', round(lp.c::numeric / (ST_Length(st.g)::numeric/100), 2),
      'bus300', bs.c, 'busdist', bs.d, 'parkdist', pk.d, 'svc400', sv.c, 'edu400', ed.c,
      'class', rd.cls, 'maxspeed', rd.speed, 'lanes', rd.lanes, 'cycle', rd.cyc, 'sidewalk', rd.sw,
      'plan', pl.j, 'votes', vt.j
    ))
  from _rn_st st
  -- צמתים: נקודות מגע עם דרכים אחרות לרכב או להולכי רגל, מקובצות ברדיוס 25 מ'
  left join lateral (select count(distinct cid) c from (
      select ST_ClusterDBSCAN(pt, 25, 1) over () cid from (
        select (ST_Dump(ST_Intersection(ST_Buffer(st.g, 4), r.g))).geom pt from _rn_o r
        where r.kind='road' and ST_DWithin(r.g, st.g, 4)
          and coalesce(r.k,'~') not in (st.nk1, st.nk2)
          and r.tags->>'highway' in ('primary','secondary','tertiary','residential','living_street','unclassified','pedestrian','trunk','primary_link','secondary_link','tertiary_link')
      ) x) y) jn on true
  left join lateral (select count(*) c, round(avg((o.tags->>'building:levels')::numeric) filter (where o.tags->>'building:levels' ~ '^[0-9]+(\.[0-9]+)?$'),1) lv,
      count(*) filter (where o.tags->>'building:levels' ~ '^[0-9]+(\.[0-9]+)?$') lvn
      from _rn_o o where o.kind='building' and ST_DWithin(o.g, st.g, 35)) b on true
  left join lateral (select count(*) c from _rn_o o where o.kind='poi' and ST_DWithin(o.g, st.g, 30)
      and (o.tags ? 'shop' or o.tags->>'amenity' in ('cafe','restaurant','pharmacy','bank','fast_food','post_office','bar','ice_cream','marketplace','clinic','doctors'))) sh on true
  left join lateral (select count(*) c from _rn_o o where o.kind='poi' and o.tags->>'highway'='crossing' and ST_DWithin(o.g, st.g, 12)) cr on true
  left join lateral (select count(*) c from _rn_o o where o.kind='poi' and o.tags->>'amenity'='bench' and ST_DWithin(o.g, st.g, 30)) be on true
  left join lateral (select count(*) c from _rn_o o where o.kind='poi' and o.tags->>'natural' in ('tree','tree_row') and ST_DWithin(o.g, st.g, 20)) tr on true
  left join lateral (select count(*) c from _rn_o o where o.kind='poi' and o.tags->>'highway'='street_lamp' and ST_DWithin(o.g, st.g, 20)) lp on true
  left join lateral (select count(*) c, round(min(ST_Distance(o.g, st.g))::numeric) d from _rn_o o where o.kind='poi' and o.tags->>'highway'='bus_stop' and ST_DWithin(o.g, st.g, 600)) bs on true
  left join lateral (select round(min(ST_Distance(o.g, st.g))::numeric) d from _rn_o o where o.kind='poi' and o.tags->>'leisure' in ('park','playground','garden') and ST_DWithin(o.g, st.g, 1500)) pk on true
  left join lateral (select count(*) c from _rn_o o where o.kind='poi' and ST_DWithin(o.g, st.g, 400)
      and (o.tags ? 'shop' or o.tags->>'amenity' in ('pharmacy','bank','clinic','doctors','post_office','library','community_centre','place_of_worship','marketplace'))) sv on true
  left join lateral (select count(*) c from _rn_edu e where ST_DWithin(e.g, st.g, 400)) ed on true
  left join lateral (
      select mode() within group (order by r.tags->>'highway') cls,
        max((substring(r.tags->>'maxspeed' from '^[0-9]+'))::int) speed,
        max((substring(r.tags->>'lanes' from '^[0-9]+'))::int) lanes,
        bool_or(r.tags ? 'cycleway' or r.tags ? 'cycleway:both' or r.tags ? 'cycleway:right' or r.tags ? 'cycleway:left') or exists(select 1 from _rn_o c where c.kind='road' and c.tags->>'highway'='cycleway' and ST_DWithin(c.g, st.g, 15) and ST_Length(ST_Intersection(c.g, ST_Buffer(st.g,15))) > 0.3*ST_Length(st.g)) cyc,
        exists(select 1 from _rn_o f where f.kind='road' and f.tags->>'highway'='footway' and f.tags->>'footway'='sidewalk' and ST_DWithin(f.g, st.g, 15)) or bool_or(r.tags->>'sidewalk' in ('both','left','right','yes')) sw
      from _rn_o r where r.kind='road' and r.k in (st.nk1, st.nk2) and ST_DWithin(r.g, st.g, 10)) rd on true
  left join lateral (select jsonb_build_object('id', p.id, 'title', p.title, 'status', p.status, 'number', p.plan_number, 'points', p.pts,
        'street', jsonb_build_object('a13', p.metrics->'13'->'score', 'a14', p.metrics->'14'->'score', 'b01', p.metrics->'16'->'score', 'b14', p.metrics->'29'->'score', 'b15', p.metrics->'30'->'score')) j
      from _rn_plan p where p.g is not null and ST_DWithin(p.g, st.g, 30) order by p.pts desc nulls last limit 1) pl on true
  left join lateral (select jsonb_build_object('n', count(*), 'avg', round(avg(((select avg(value::numeric) from jsonb_each_text(v.scores))))::numeric, 2)) j
      from streets s2 join votes v on v.street_id = s2.id and not v.is_demo where s2.code = st.code::text having count(*) > 0) vt on true;
  get diagnostics n = row_count;
  insert into rn_street_metrics(code, name, quarter_id, quarter_source, line, m)
  select code, name, quarter_id, qsrc, null, jsonb_build_object('geo', reason, 'len', len) from _rn_skip;
  get diagnostics k = row_count;
  n := n + k;
  update rn_street_metrics set computed_at = now();
  return n;
end $$;
revoke execute on function public.rn_compute() from anon, authenticated, public;
