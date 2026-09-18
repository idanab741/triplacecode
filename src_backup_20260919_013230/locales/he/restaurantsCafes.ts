import type { StepOption } from "@/services/tripBuilder/types";
import { CULINARY_STYLES } from "@/locales/he/preferences";

export const RESTAURANT_COMPANION_OPTIONS: StepOption[] = [
  { value: "couple", label: "זוג", emoji: "💑" },
  { value: "family", label: "משפחה עם ילדים", emoji: "👨‍👩‍👧‍👦" },
  { value: "friends", label: "חברים", emoji: "🙋" },
  { value: "solo", label: "לבד", emoji: "🧍" },
];

export const RESTAURANT_PET_OPTION: StepOption = { value: "with_pet", label: "עם בעל חיים", emoji: "🐶" };

export const RESTAURANT_CHILD_AGE_OPTIONS: StepOption[] = [
  { value: "0-3", label: "0‑3" },
  { value: "3-7", label: "3‑7" },
  { value: "7-12", label: "7‑12" },
  { value: "12-18", label: "12‑18" },
];

export const RESTAURANT_TIMING_OPTIONS: StepOption[] = [
  { value: "today", label: "היום" },
  { value: "tomorrow", label: "מחר" },
  { value: "other_date", label: "תאריך אחר" },
];

export const RESTAURANT_DISTANCE_STEPS: StepOption[] = [
  { value: "10min", label: "10\u00A0דקות" },
  { value: "20min", label: "20\u00A0דקות" },
  { value: "30min", label: "30\u00A0דקות" },
  { value: "40min", label: "40\u00A0דקות" },
  { value: "50min", label: "50\u00A0דקות" },
  { value: "1h", label: "שעה" },
  { value: "1.5h", label: "שעה\u00A0וחצי" },
  { value: "2h", label: "שעתיים" },
  { value: "2.5h", label: "שעתיים\u00A0וחצי" },
  { value: "3h", label: "3\u00A0שעות" },
  { value: "4h", label: "4\u00A0שעות" },
  { value: "5h", label: "5\u00A0שעות" },
];

export const RESTAURANT_BUDGET_STEPS: StepOption[] = [
  { value: "0-100", label: "₪0‑100" },
  { value: "100-300", label: "₪100‑300" },
  { value: "300-600", label: "₪300‑600" },
  { value: "600-1000", label: "₪600‑1,000" },
  { value: "unlimited", label: "ללא הגבלה" },
];

// אימוג'י גיבוי לכל סגנון - משמש כברירת מחדל אם עדיין אין imageSrc
// (CULINARY_STYLES) לערך הזה, וגם כ-fallback אוטומטי אם התמונה נכשלת
// לטעון בפועל (ר' ChipGroup.tsx) - למשל local_food.png שעוד לא הועלה
// לתיקיית /public/images/preferences/culinary.
const CUISINE_EMOJI_FALLBACK: Record<string, string> = {
  israeli: "🥙",
  italian: "🍝",
  asian: "🥢",
  meat_bbq: "🍖",
  burger_diner: "🍔",
  mexican: "🌮",
  greek: "🫓",
  french_bistro: "🥖",
  indian: "🍛",
  mediterranean: "🫒",
  seafood: "🐟",
  pizza: "🍕",
  breakfast_brunch: "🥐",
  cafe: "☕",
  fine_dining: "👨‍🍳",
  local_food: "🍲",
  snacks_sweets: "🍰",
};

// *** מקור אמת יחיד: נבנה ישירות מ-CULINARY_STYLES (locales/he/preferences.ts,
// אותה רשימה המוצגת בהתאמה האישית) - כולל אותן תמונות (imageSrc) בדיוק,
// כדי שהצ'אט של מסעדות/קפה יציג את אותם אייקונים אמיתיים שכבר קיימים
// בתמונות ההעדפות, לא רק אימוג'י. קודם הרשימה כאן הייתה מוגדרת בנפרד
// לגמרי (בלי imageSrc בכלל, ועם כמה value-ים לא תואמים) - מה שגם גרם
// לחוסר עקביות מול dna.culinary_styles וגם השאיר את הצ'אט בלי האייקונים
// האמיתיים שכבר קיימים במערכת.
export const CUISINE_OPTIONS: StepOption[] = CULINARY_STYLES.map((style) => ({
  value: style.value,
  label: style.label,
  imageSrc: style.imageSrc,
  emoji: CUISINE_EMOJI_FALLBACK[style.value],
}));

export const SURPRISE_ME_OPTION: StepOption = { value: "surprise_me", label: "תפתיע אותי", emoji: "🎁" };