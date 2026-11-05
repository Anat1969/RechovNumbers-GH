import { useEffect, useMemo, useState } from 'react';
import { buildModel, summarize } from './lib/model';
import { loadLive, loadSnapshot, type Loaded } from './lib/data';
import { useRoute } from './lib/route';
import { QMAP } from './data/quarters';
import TopBar from './components/TopBar';
import type { MenuItem } from './components/AIMenu';
import Home from './pages/Home';
import Quarter from './pages/Quarter';
import StreetPage from './pages/StreetPage';
import Cross from './pages/Cross';
import Method from './pages/Method';
import Actions from './pages/Actions';

function downloadCsv(rows: (string | number | null)[][], name: string) {
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name; a.click();
}

export default function App() {
  const route = useRoute();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = async () => {
    const live = await loadLive();
    if (live) setData(live);
    return !!live;
  };
  useEffect(() => {
    let alive = true;
    loadSnapshot().then((s) => { if (alive && s && s.streets.length) setData((d) => d ?? s); });
    loadLive().then((l) => { if (!alive) return; if (l) setData(l); else setData((d) => { if (!d) setFailed(true); return d; }); });
    return () => { alive = false; };
  }, []);

  const model = useMemo(() => (data ? buildModel(data.streets) : null), [data]);

  useEffect(() => {
    const q = route.page === 'quarter' && route.id ? QMAP[route.id]?.name : null;
    const s = route.page === 'street' && model ? model.byCode[Number(route.id)]?.s.name : null;
    document.title = (s ?? q ?? ({ cross: 'ההצלבה', method: 'איך מודדים', actions: 'תוכנית פעולה' } as Record<string, string>)[route.page] ?? '') + (s || q || ['cross', 'method', 'actions'].includes(route.page) ? ' · ' : '') + 'רחוב טוב במספרים';
  }, [route, model]);

  const menu: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [{ label: 'רענון הנתונים מהשרת', hint: data?.source === 'live' ? 'חי' : 'שמור', onSelect: refresh }];
    if (model) {
      const qid = route.page === 'quarter' ? route.id : route.page === 'street' ? model.byCode[Number(route.id)]?.s.quarter_id : null;
      const sum = summarize(model, qid ? [qid] : null);
      items.push({
        label: qid ? `הורדת הדירוג של ${QMAP[qid]?.name ?? 'הרובע'} (CSV)` : 'הורדת הדירוג של כל העיר (CSV)',
        onSelect: () => downloadCsv([
          ['מקום', 'רחוב', 'רובע', 'ציון', 'נקודות', ...model.entering.map((p) => p.label)],
          ...sum.streets.map((x, i) => [i + 1, x.s.name, x.s.quarter_id ? QMAP[x.s.quarter_id]?.name ?? '' : '', x.total, Math.round(x.points * 10) / 10, ...model.entering.map((p) => x.values[p.key])]),
        ], `rechov-numbers-${qid ?? 'ashdod'}.csv`),
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, route, data?.source]);

  const status = data ? (data.source === 'live' ? 'נתונים חיים' : 'תמונה שמורה') : '';

  let page;
  if (!model) page = <main className="body"><div className="loading">{failed ? 'הנתונים לא נטענו. בדקו את החיבור ורעננו את הדף.' : 'טוען 525 רחובות...'}</div></main>;
  else if (route.page === 'quarter') page = <Quarter model={model} route={route} />;
  else if (route.page === 'street') page = <StreetPage model={model} route={route} />;
  else if (route.page === 'cross') page = <Cross model={model} route={route} />;
  else if (route.page === 'actions') page = <Actions model={model} route={route} />;
  else if (route.page === 'method') page = <Method model={model} takenAt={data!.taken_at} source={data!.source} />;
  else page = <Home model={model} />;

  return (
    <div className="shell" style={route.page === 'quarter' ? undefined : { gridTemplateRows: 'auto minmax(0,1fr)' }}>
      <TopBar route={route} model={model} menu={menu} status={status} />
      {page}
    </div>
  );
}
