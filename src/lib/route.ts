import { useEffect, useState } from 'react';

// המצב נשמר בכתובת (hash): דף, רובע, רחוב ושכבת צבע. "העתקת קישור" פותחת את אותו מצב.
export interface Route { page: 'home' | 'quarter' | 'street' | 'cross' | 'method'; id?: string; q: URLSearchParams }

export function parse(hash = location.hash): Route {
  const [path, qs] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const q = new URLSearchParams(qs ?? '');
  if (parts[0] === 'q' && parts[1]) return { page: 'quarter', id: decodeURIComponent(parts[1]), q };
  if (parts[0] === 's' && parts[1]) return { page: 'street', id: parts[1], q };
  if (parts[0] === 'x') return { page: 'cross', q };
  if (parts[0] === 'm') return { page: 'method', q };
  return { page: 'home', q };
}

export function go(hash: string) { if (location.hash !== hash) location.hash = hash; }

/** מחליף פרמטר בכתובת בלי ליצור רשומה חדשה בהיסטוריה. */
export function setParam(key: string, value: string | null) {
  const [path, qs] = location.hash.replace(/^#/, '').split('?');
  const q = new URLSearchParams(qs ?? '');
  if (value == null || value === '') q.delete(key); else q.set(key, value);
  const s = q.toString();
  history.replaceState(null, '', '#' + path + (s ? '?' + s : ''));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute() {
  const [r, setR] = useState(parse());
  useEffect(() => {
    const on = () => setR(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
