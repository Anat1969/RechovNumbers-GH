// טקסט עשיר (תבנית Rich של anat-design-language): **מודגש**, ==תובנה== (מרקר), ומספרים מודגשים אוטומטית בכיוון LTR מבודד.
import type { ElementType } from 'react';

const TOKEN = /(\*\*[^*]+\*\*|==[^=]+==)/g;
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
        if (part.startsWith('==')) return <mark key={i} className="insight"><Numbers text={part.slice(2, -2)} /></mark>;
        return <Numbers key={i} text={part} />;
      })}
    </Tag>
  );
}
