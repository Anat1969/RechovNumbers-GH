// טקסט עשיר (תבנית Rich של anat-design-language): **מודגש**, ==תובנה== (מרקר), ומספרים מודגשים אוטומטית בכיוון LTR מבודד.
import type { ElementType } from 'react';

// מרקר קודם, כדי ש-**מודגש** בתוך ==תובנה== יוצג כמודגש בתוך המרקר
const TOKEN = /(==[^=]+==|\*\*[^*]+\*\*)/g;
const BOLD = /\*\*([^*]+)\*\*/g;
const NUM = /(\d[\d,]*(?:\.\d+)?%?)/g;

function Numbers({ text }: { text: string }) {
  return <>{text.split(NUM).map((part, i) => (i % 2 ? <bdi key={i} className="num">{part}</bdi> : part))}</>;
}

export default function Rich({ children, as: Tag = 'span', className }: { children: string; as?: ElementType; className?: string }) {
  const parts = String(children).split(TOKEN);
  return (
    <Tag className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('**')) return <strong key={i}><Numbers text={part.slice(2, -2)} /></strong>;
        if (part.startsWith('==')) return <mark key={i} className="insight">{part.slice(2, -2).split(BOLD).map((q, j) => (j % 2 ? <strong key={j}><Numbers text={q} /></strong> : <Numbers key={j} text={q} />))}</mark>;
        return <Numbers key={i} text={part} />;
      })}
    </Tag>
  );
}
