// סט אייקוני קו אחד: עובי 1.7, קצוות מרובעים, בצבע הטקסט. כל אייקון שייך לפעולה אחת, ובכל מקום אותו אייקון לאותה פעולה.
const P: Record<string, string> = {
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14',
  act: 'M4 6h11 M4 12h8 M4 18h11 M17 10l2 2 4-4',
  ruler: 'M3 16L16 3l5 5L8 21z M7 12l2 2 M10 9l2 2 M13 6l2 2',
  bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  tools: 'M14 6l4 4 M4 20l9-9 M13 11l3-3a3 3 0 0 0 4-4l-2 2-2-2 2-2a3 3 0 0 0-4 4l-3 3',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h1 M3 12h1 M3 18h1',
  chart: 'M4 20V4 M4 20h16 M8 16v-5 M12 16V8 M16 16v-8',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01',
  sat: 'M5 13l6 6 M8 10l6 6 M3 21l3-3 M14 4l6 6-4 4-6-6z M12 8L9 5 5 9l3 3',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  replay: 'M4 12a8 8 0 1 0 2.3-5.7 M4 4v4h4',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  next: 'M15 6l-6 6 6 6',
  prev: 'M9 6l6 6-6 6',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  street: 'M4 20L10 4 M20 20L14 4 M12 6v2 M12 11v2 M12 16v2',
};

export default function Icon({ n, size = 18 }: { n: keyof typeof P | string; size?: number }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="square" strokeLinejoin="miter">
      <path d={P[n] ?? ''} />
    </svg>
  );
}
