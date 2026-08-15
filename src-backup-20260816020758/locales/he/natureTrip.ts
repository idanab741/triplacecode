import type { StepOption } from "@/services/tripBuilder/types";

export const NATURE_TYPE_OPTIONS: StepOption[] = [
  { value: "springs_streams", label: "מעיינות ונחלים", emoji: "💧" },
  { value: "viewpoints_scenery", label: "תצפיות ונופים", emoji: "🌄" },
  { value: "forests_groves", label: "יערות וחורשות", emoji: "🌳" },
  { value: "hiking_trails", label: "מסלולי הליכה", emoji: "🥾" },
  { value: "seasonal_bloom", label: "פריחה עונתית", emoji: "🌸" },
  { value: "caves_phenomena", label: "מערות ותופעות טבע", emoji: "🪨" },
  { value: "desert_canyons", label: "מדבר וקניונים", emoji: "🏜️" },
  { value: "waterfalls", label: "מפלים (עונתיים)", emoji: "💦" },
  { value: "wildlife", label: "טבע ובעלי חיים", emoji: "🦌" },
  { value: "sunrise_sunset", label: "זריחה או שקיעה", emoji: "🌅" },
  { value: "photogenic_spots", label: "מקומות פוטוגניים / אינסטגרמי", emoji: "📸" },
  { value: "picnic_nature", label: "פיקניק בטבע", emoji: "🧺" },
  { value: "nature_reserves", label: "שמורות טבע", emoji: "🌿" },
];

export const DIFFICULTY_OPTIONS: StepOption[] = [
  { value: "easy", label: "קל", emoji: "🟢" },
  { value: "moderate", label: "בינוני", emoji: "🟠" },
  { value: "challenging", label: "מאתגר / קשה", emoji: "🔴" },
];

export const NATURE_DURATION_OPTIONS: StepOption[] = [
  { value: "1-2h", label: "שעה-שעתיים" },
  { value: "half_day", label: "חצי יום" },
  { value: "full_day", label: "יום שלם" },
  { value: "custom", label: "זמן מותאם אישית" },
];

/** מיפוי מסוג הטבע (בחירת המשתמש) לקטגוריית ה-DB בפועל, למקרה שנזדקק לו (fallback דטרמיניסטי / תאימות עתידית). */
export const NATURE_TYPE_TO_CATEGORY: Record<string, string> = {
  springs_streams: "nature_trails",
  viewpoints_scenery: "nature_trails",
  forests_groves: "nature_trails",
  hiking_trails: "nature_trails",
  seasonal_bloom: "nature_trails",
  caves_phenomena: "nature_trails",
  desert_canyons: "nature_trails",
  waterfalls: "nature_trails",
  wildlife: "nature_trails",
  sunrise_sunset: "viewpoints",
  photogenic_spots: "viewpoints",
  picnic_nature: "parks_gardens",
  nature_reserves: "nature_trails",
};

export const NATURE_TYPE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  NATURE_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

export function getNatureTypeLabel(value: string): string {
  return NATURE_TYPE_LABEL_MAP[value] ?? value;
}

export const DIFFICULTY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  DIFFICULTY_OPTIONS.map((option) => [option.value, option.label])
);

export function getDifficultyLabel(value: string): string {
  return DIFFICULTY_LABEL_MAP[value] ?? value;
}
