// עקרונות הרחוב הטוב, כפי שהם באפליקציה "רחובות טובים באשדוד" (Anat1969/NiceStreets-GH, lib/city.ts).
// שנים־עשר קריטריונים מתוך "הרחובות הטובים — זיקוק הקריטריונים" (מינהל התכנון, 2026),
// ושלוש שאלות מקומיות שהמסמך לא מודד ואשדוד כן שואלת: שהייה, תחזוקה וביטחון.

export type FamilyKey = 'skeleton' | 'section' | 'frontage' | 'texture' | 'local';

export interface Family { key: FamilyKey; title: string; question: string; color: string }
export interface Criterion { key: string; name: string; family: FamilyKey; text: string; local?: boolean }

/** צבעי המשפחות: צבעי תפקיד על לבן (תעודת DNA). */
export const FAMILIES: Family[] = [
  { key: 'skeleton', title: 'שלד', question: 'האם מגיעים לרחוב?', color: '#2C5F9E' },
  { key: 'section', title: 'חתך', question: 'האם נעים לעמוד בו?', color: '#7A5AA6' },
  { key: 'frontage', title: 'דופן', question: 'האם מעניין ללכת בו?', color: '#B4532A' },
  { key: 'texture', title: 'מרקם ואקלים', question: 'האם ישרוד קיץ?', color: '#3C8C4A' },
  { key: 'local', title: 'חוויה מקומית', question: 'האם נעים להישאר?', color: '#96690F' },
];
export const FAMILY = Object.fromEntries(FAMILIES.map((f) => [f.key, f])) as Record<FamilyKey, Family>;

export const CRITERIA: Criterion[] = [
  { key: 'place_and_movement', name: 'מקום ותנועה', family: 'skeleton', text: 'הרחוב האהוב הוא יעד בפני עצמו, לא רק צינור שעוברים בו.' },
  { key: 'intersection_density', name: 'צפיפות צמתים', family: 'skeleton', text: 'צמתים קרובים: יותר דרכים להגיע, יותר הליכה ויותר מסחר.' },
  { key: 'mixed_use', name: 'עירוב שימושים', family: 'skeleton', text: 'רחוב חי הוא רחוב שיש סיבה להגיע אליו בכל שעה.' },
  { key: 'row_width', name: 'רוחב זכות הדרך', family: 'section', text: 'צר עובד: אפשר לחצות, לראות את הצד השני ולהרגיש בתוך חלל.' },
  { key: 'proportions', name: 'פרופורציות ומוגדרות', family: 'section', text: 'הרחוב מרגיש כמו חדר כשהבניינים או העצים סוגרים עליו.' },
  { key: 'row_split', name: 'חלוקת זכות הדרך', family: 'section', text: 'למי שייך הרחוב: לרכב או לאדם.' },
  { key: 'plot_street_meeting', name: 'מפגש מגרש–רחוב', family: 'frontage', text: 'המטר הראשון מהמדרכה קובע אם הבניין מדבר עם הרחוב.' },
  { key: 'transparency', name: 'שקיפות וחזית פעילה', family: 'frontage', text: 'חזית שקופה מזמינה סקרנות וביטחון, חזית אטומה מנתקת.' },
  { key: 'building_rhythm', name: 'מקצב בניינים', family: 'frontage', text: 'הרבה בניינים קטנים: הליכה מעניינת וקנה מידה אנושי.' },
  { key: 'shared_language', name: 'שפה משותפת עם מגוון', family: 'frontage', text: 'מסגרת אחת, הרבה קולות.' },
  { key: 'small_plots', name: 'מגרשים קטנים', family: 'texture', text: 'מגרש קטן מאפשר לרחוב להתחדש בהדרגה.' },
  { key: 'tree_canopy', name: 'חופת עצים והצללה', family: 'texture', text: 'באקלים הישראלי הצל הוא תנאי להליכה, לא קישוט.' },
  { key: 'staying', name: 'מקום לשהות', family: 'local', local: true, text: 'ספסל, כיכר קטנה או פינה שאפשר לעצור בה.' },
  { key: 'maintenance', name: 'תחזוקה', family: 'local', local: true, text: 'רחוב נקי, מדרכה שלמה ותאורה שעובדת.' },
  { key: 'safety', name: 'ביטחון', family: 'local', local: true, text: 'נעים ובטוח להיות ברחוב גם בערב.' },
];
export const CRIT = Object.fromEntries(CRITERIA.map((c) => [c.key, c])) as Record<string, Criterion>;

/**
 * ההצלבה: אילו מ-44 מדדי שכונה 360 נוגעים בכל עיקרון של הרחוב הטוב.
 * זו הצעה מקצועית של האפליקציה, לא טבלה מאחת החוברות. מדד שלא מופיע כאן הוא שכונתי ולא נמדד ברמת רחוב.
 */
export const CROSS: Record<string, string[]> = {
  place_and_movement: ['b03', 'b02', 'a10'],
  intersection_density: ['a14', 'a15'],
  mixed_use: ['a10', 'a11', 'a08'],
  row_width: ['b06', 'b04'],
  proportions: ['a12', 'b16', 'c03'],
  row_split: ['b01', 'b04', 'b06'],
  plot_street_meeting: ['a13'],
  transparency: ['a13'],
  building_rhythm: ['a13', 'a08'],
  shared_language: ['a07'],
  small_plots: ['a08'],
  tree_canopy: ['b14', 'b15', 'b13', 'b11'],
  staying: ['b07', 'b01'],
  maintenance: ['c07'],
  safety: ['b02', 'c04', 'b19'],
};
