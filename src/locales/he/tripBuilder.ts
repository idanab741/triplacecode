import type { StepOption } from "@/services/tripBuilder/types";

export const COMPANION_OPTIONS: StepOption[] = [
  { value: "couple", label: "זוג", emoji: "💑" },
  { value: "family", label: "משפחה עם ילדים", emoji: "👨‍👩‍👧‍👦" },
  { value: "friends", label: "חברים", emoji: "🙋" },
  { value: "solo", label: "לבד", emoji: "🧍" },
  { value: "with_pet", label: "עם בעל חיים", emoji: "🐶" },
];

export const CHILD_AGE_OPTIONS: StepOption[] = [
  { value: "0-3", label: "0-3" },
  { value: "3-7", label: "3-7" },
  { value: "7-12", label: "7-12" },
  { value: "12-18", label: "12-18" },
];

export const TIMING_OPTIONS: StepOption[] = [
  { value: "today", label: "היום" },
  { value: "tomorrow", label: "מחר" },
  { value: "other_date", label: "תאריך אחר" },
];

export const DISTANCE_STEPS: StepOption[] = [
  { value: "10min", label: "10 דקות" },
  { value: "20min", label: "20 דקות" },
  { value: "30min", label: "30 דקות" },
  { value: "40min", label: "40 דקות" },
  { value: "50min", label: "50 דקות" },
  { value: "1h", label: "שעה" },
  { value: "1.5h", label: "שעה וחצי" },
  { value: "2h", label: "שעתיים" },
  { value: "2.5h", label: "שעתיים וחצי" },
  { value: "3h", label: "3 שעות" },
  { value: "4h", label: "4 שעות" },
  { value: "5h", label: "5 שעות" },
];

export const BUDGET_STEPS: StepOption[] = [
  { value: "0-100", label: "₪0-100" },
  { value: "100-300", label: "₪100-300" },
  { value: "300-600", label: "₪300-600" },
  { value: "600-1000", label: "₪600-1,000" },
  { value: "unlimited", label: "ללא הגבלה" },
];

export const DAY_TRIP_INTEREST_OPTIONS: StepOption[] = [
  { value: "coffee_carts_cafes", label: "עגלות קפה ובתי קפה", emoji: "☕" },
  { value: "nature_trails", label: "מסלולי טבע ונופים", emoji: "🌿" },
  { value: "beaches_pools", label: "חופי ים ובריכות", emoji: "🏖️" },
  { value: "viewpoints", label: "תצפיות, זריחות ושקיעות", emoji: "🌅" },
  { value: "parks_gardens", label: "פארקים וגנים", emoji: "🌳" },
  { value: "water_amusement_parks", label: "פארקי מים, שעשועים ומתקנים", emoji: "🎡" },
  { value: "attractions_activities", label: "אטרקציות ופעילויות", emoji: "🎯" },
  { value: "sports_extreme", label: "ספורט ואקסטרים", emoji: "🚴" },
  { value: "wineries_dining", label: "יקבים, מבשלות ומסעדות", emoji: "🍷" },
  { value: "culture_history", label: "תרבות, מוזיאונים והיסטוריה", emoji: "🏛️" },
  { value: "shopping", label: "שופינג, קניות ושווקים", emoji: "🛍️" },
  { value: "events_festivals", label: "אירועים ופסטיבלים", emoji: "🎪" },
  { value: "spa_relaxation", label: "ספא ורוגע", emoji: "🧖" },
];

export const DURATION_OPTIONS: StepOption[] = [
  { value: "1-2h", label: "שעה-שעתיים" },
  { value: "2-4h", label: "2-4 שעות" },
  { value: "4-6h", label: "4-6 שעות" },
  { value: "full_day", label: "יום שלם" },
  { value: "custom", label: "זמן מותאם אישית" },
];
