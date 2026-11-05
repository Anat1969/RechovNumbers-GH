// הרבעים והאזורים של אשדוד, כפי שהם ברשימה העירונית של NiceStreets-GH (lib/city.ts).
export interface Quarter { id: string; name: string; short: string; kind: 'quarter' | 'area' }

export const QUARTERS: Quarter[] = ([
  ['q-a', "רובע א'", 'א'], ['q-b', "רובע ב'", 'ב'], ['q-c', "רובע ג'", 'ג'], ['q-d', "רובע ד'", 'ד'],
  ['q-e', "רובע ה'", 'ה'], ['q-f', "רובע ו'", 'ו'], ['q-g', "רובע ז'", 'ז'], ['q-h', "רובע ח'", 'ח'],
  ['q-i', "רובע ט'", 'ט'], ['q-j', "רובע י'", 'י'], ['q-k', 'רובע י"א', 'יא'], ['q-l', 'רובע י"ב', 'יב'],
  ['q-m', 'רובע י"ג', 'יג'], ['q-n', 'רובע י"ד', 'יד'], ['q-o', 'רובע ט"ו', 'טו'], ['q-p', 'רובע ט"ז', 'טז'],
  ['q-q', 'רובע י"ז', 'יז'],
] as string[][]).map(([id, name, short]): Quarter => ({ id, name, short, kind: 'quarter' }))
  .concat([
    ['q-city', 'הקריה (הסיטי)', 'הקריה'], ['q-marina', 'המרינה והחוף', 'מרינה'], ['q-cbd-south', 'מע"ר דרום', 'מע"ר'],
    ['q-main-axis', 'צירים חוצי עיר', 'צירים'], ['q-port', 'עורף הנמל', 'נמל'],
    ['q-ind-north', 'אזור תעשייה צפוני', 'תעשייה צפון'], ['q-ind-halutzim', 'אזור תעשייה קריית חלוצים', 'חלוצים'],
    ['q-ind-light', 'אזור תעשייה קלה', 'תעשייה קלה'], ['q-ind-ad-halom', 'אזור תעשייה עד הלום', 'עד הלום'],
  ].map(([id, name, short]): Quarter => ({ id, name, short, kind: 'area' })));

export const QMAP = Object.fromEntries(QUARTERS.map((q) => [q.id, q])) as Record<string, Quarter>;
