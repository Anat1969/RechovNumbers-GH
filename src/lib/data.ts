import type { Street } from './model';

export const SUPABASE = 'https://cbhexpybdggwzyakgagd.supabase.co';
export const ANON = 'sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3';

export interface Loaded { streets: Street[]; taken_at: string; source: 'live' | 'snapshot' }

/** קודם התמונה השמורה (מיידית), ואחריה הנתונים החיים כשהשרת עונה. */
export async function loadSnapshot(): Promise<Loaded | null> {
  try {
    const r = await fetch('./data/snapshot.json', { cache: 'no-cache' });
    if (!r.ok) return null;
    const j = await r.json();
    return { streets: j.streets ?? [], taken_at: j.taken_at ?? '', source: 'snapshot' };
  } catch { return null; }
}

export async function loadLive(): Promise<Loaded | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(`${SUPABASE}/rest/v1/rn_street_metrics?select=code,name,quarter_id,quarter_source,line,m,computed_at&order=code`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` }, signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const rows = (await r.json()) as (Street & { computed_at: string })[];
    if (!rows.length) return null;
    const taken_at = rows.reduce((a, s) => (s.computed_at > a ? s.computed_at : a), '');
    return { streets: rows, taken_at, source: 'live' };
  } catch { return null; }
}

export interface Distilled { provider: string; diagnosis: string; lever: string; action: string }
export async function distill(payload: unknown): Promise<Distilled> {
  const r = await fetch(`${SUPABASE}/functions/v1/rn-distill`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON }, body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.diagnosis) throw new Error(j.error ?? 'unavailable');
  return j as Distilled;
}
