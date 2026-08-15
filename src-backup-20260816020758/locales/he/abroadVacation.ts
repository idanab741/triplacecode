import type { StepOption } from "@/services/tripBuilder/types";

export const VACATION_COMPANION_OPTIONS: StepOption[] = [
  { value: "couple", label: "זוג", emoji: "💑" },
  { value: "family", label: "משפחה עם ילדים", emoji: "👨‍👩‍👧‍👦" },
  { value: "friends", label: "חברים", emoji: "🙋" },
  { value: "solo", label: "לבד", emoji: "🧍" },
];

export const VACATION_CHILD_AGE_OPTIONS: StepOption[] = [
  { value: "0-3", label: "0‑3" },
  { value: "3-7", label: "3‑7" },
  { value: "7-12", label: "7‑12" },
  { value: "12-18", label: "12‑18" },
];

export const LODGING_TYPE_OPTIONS: StepOption[] = [
  { value: "hotel", label: "מלון", emoji: "🏨" },
  { value: "resort", label: "ריזורט", emoji: "🏝️" },
  { value: "apartment", label: "דירה", emoji: "🏠" },
  { value: "cabin", label: "צימר", emoji: "🛖" },
  { value: "hostel", label: "הוסטל", emoji: "🛏️" },
  { value: "camping", label: "קמפינג", emoji: "⛺" },
  { value: "glamping", label: "גלמפינג", emoji: "🏕️" },
  { value: "villa", label: "וילה", emoji: "🏡" },
];

export const VACATION_BUDGET_STEPS: StepOption[] = [
  { value: "0-2500", label: "₪0‑2,500" },
  { value: "2500-7500", label: "₪2,500‑7,500" },
  { value: "7500-12000", label: "₪7,500‑12,000" },
  { value: "12000+", label: "מעל ₪12,000" },
  { value: "unlimited", label: "ללא הגבלה" },
];

export const VACATION_TYPE_OPTIONS: StepOption[] = [
  { value: "relax", label: "בטן־גב ורוגע", emoji: "🏖️" },
  { value: "nature_adventure", label: "טבע והרפתקאות", emoji: "🌿" },
  { value: "urban", label: "טיול אורבני בעיר הגדולה", emoji: "🏙️" },
  { value: "shopping", label: "שופינג וקניות", emoji: "🛍️" },
  { value: "culinary", label: "קולינריה ומסעדות", emoji: "🍽️" },
  { value: "museums_history", label: "מוזיאונים והיסטוריה", emoji: "🏛️" },
  { value: "culture_art", label: "תרבות ואמנות", emoji: "🎭" },
  { value: "family", label: "משפחתי", emoji: "👨‍👩‍👧‍👦" },
  { value: "nightlife", label: "חיי לילה ובילויים", emoji: "🌃" },
  { value: "sports_extreme", label: "ספורט ואקסטרים", emoji: "🚴" },
  { value: "spa_wellness", label: "ספא ווולנס", emoji: "🧖" },
  { value: "ski", label: "סקי", emoji: "⛷️" },
];

export const VACATION_PACE_OPTIONS: StepOption[] = [
  { value: "relaxed", label: "רגוע", emoji: "🌿" },
  { value: "balanced", label: "מאוזן", emoji: "⚖️" },
  { value: "packed", label: "מתוכנן", emoji: "🚀" },
];

export const TRAVEL_STYLE_OPTIONS: StepOption[] = [
  { value: "single_destination", label: "יעד אחד בלבד" },
  { value: "multi_destination", label: "מספר יעדים" },
];

export const VACATION_TYPE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  VACATION_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

/**
 * ממיר ערך vacationType (למשל "nightlife") לתווית עברית. בשונה מ-getCategoryLabel
 * (שמיועד לקטגוריות DB כמו "attractions_activities") - ערכי vacationTypes הם
 * enum נפרד לגמרי, ורוב הערכים שלו (nightlife, urban, relax, sports_extreme...)
 * לא קיימים ב-getCategoryLabel כלל ומוחזרים ממנו כמו שהם (באנגלית) - מה שיוצר
 * סיגנל חלש/מבלבל בפרומפט ל-Claude, שיכול לגרום לו להתעלם מהעדפה שלמה
 * (למשל "חיי לילה") כי היא מגיעה כמילה בודדת באנגלית בתוך פרומפט בעברית.
 */
export function getVacationTypeLabel(value: string): string {
  return VACATION_TYPE_LABEL_MAP[value] ?? value;
}


export const VACATION_PACE_DAILY_COUNTS: Record<
  "relaxed" | "balanced" | "packed",
  { attractions: number; food: number }
> = {
  relaxed: { attractions: 2, food: 2 },
  balanced: { attractions: 3, food: 3 },
  packed: { attractions: 5, food: 3 },
};

/** מיפוי מסוג החופשה (מה שהמשתמש בוחר) לקטגוריית ה-DB בפועל (trip_type_tags group). */
export const VACATION_TYPE_TO_CATEGORY: Record<string, string> = {
  relax: "beaches_pools",
  nature_adventure: "nature_trails",
  urban: "culture_history",
  shopping: "shopping",
  culinary: "wineries_dining",
  museums_history: "culture_history",
  culture_art: "culture_history",
  family: "attractions_activities",
  nightlife: "attractions_activities",
  sports_extreme: "sports_extreme",
  spa_wellness: "spa_relaxation",
  ski: "sports_extreme",
};
export const FLIGHT_PREFERENCE_OPTIONS: StepOption[] = [
  { value: "direct", label: "טיסה ישירה", emoji: "🎯" },
  { value: "one_stop", label: "עד קונקשן אחד", emoji: "🔄" },
  { value: "two_plus_stops", label: "שני קונקשנים ומעלה", emoji: "🔁" },
];