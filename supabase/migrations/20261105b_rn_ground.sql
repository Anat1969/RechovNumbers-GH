-- רקע דמות־קרקע (Nolli) למפה: מצולעי בניינים וגנים. ממתין לאישור החלה (05.11.2026).
-- אחרי ההחלה מריצים:
--   select rn_fetch_osm('building_fp', 'way["building"](31.74,34.58,31.87,34.73);out tags geom;');
--   select rn_fetch_osm('park_fp', '(way["leisure"~"^(park|playground|garden|pitch)$"](31.74,34.58,31.87,34.73);way["landuse"~"^(grass|recreation_ground|village_green)$"](31.74,34.58,31.87,34.73););out tags geom;');

create or replace function public.rn_fetch_osm(p_kind text, p_query text)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb; raw text; n int; ep text;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','58000');
  foreach ep in array array['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'] loop
    begin
      select content into raw from extensions.http_get(ep || '?data=' || extensions.urlencode('[out:json][timeout:55];' || p_query));
      r := raw::jsonb;
      exit;
    exception when others then r := null;
    end;
  end loop;
  if r is null then raise exception 'overpass failed: %', left(coalesce(raw,''), 300); end if;
  delete from rn_osm where kind = p_kind;
  insert into rn_osm(kind, osm_id, tags, geom)
  select p_kind, (e->>'id')::bigint, e->'tags',
    case
      when e ? 'geometry' then (
        select case when count(*) >= 4 and (array_agg(g order by ord))[1] = (array_agg(g order by ord))[count(*)]
                    then ST_MakePolygon(ST_MakeLine(array_agg(ST_SetSRID(ST_MakePoint((g->>'lon')::float, (g->>'lat')::float),4326) order by ord)))
                    else ST_MakeLine(array_agg(ST_SetSRID(ST_MakePoint((g->>'lon')::float, (g->>'lat')::float),4326) order by ord)) end
        from jsonb_array_elements(e->'geometry') with ordinality as t(g, ord))
      when e ? 'center' then ST_SetSRID(ST_MakePoint((e->'center'->>'lon')::float, (e->'center'->>'lat')::float),4326)
      else ST_SetSRID(ST_MakePoint((e->>'lon')::float, (e->>'lat')::float),4326)
    end
  from jsonb_array_elements(r->'elements') e
  where e->>'type' in ('node','way')
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.rn_fetch_osm(text,text) from anon, authenticated, public;

create or replace function public.rn_ground(min_lon float, min_lat float, max_lon float, max_lat float)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'b', coalesce((select jsonb_agg(ST_AsGeoJSON(ST_SimplifyPreserveTopology(o.geom, 0.000008), 5)::jsonb->'coordinates'->0)
           from rn_osm o where o.kind = 'building_fp' and ST_GeometryType(o.geom) = 'ST_Polygon'
             and o.geom && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
             and (max_lon - min_lon) < 0.06 and (max_lat - min_lat) < 0.06), '[]'::jsonb),
    'p', coalesce((select jsonb_agg(ST_AsGeoJSON(ST_SimplifyPreserveTopology(o.geom, 0.00001), 5)::jsonb->'coordinates'->0)
           from rn_osm o where o.kind = 'park_fp' and ST_GeometryType(o.geom) = 'ST_Polygon'
             and o.geom && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)), '[]'::jsonb));
$$;
grant execute on function public.rn_ground(float, float, float, float) to anon, authenticated;
