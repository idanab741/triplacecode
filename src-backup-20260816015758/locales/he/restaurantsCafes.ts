import type { StepOption } from "@/services/tripBuilder/types";

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

export const CUISINE_OPTIONS: StepOption[] = [
{ value: "israeli", label: "ישראלי", emoji: "🥙" },
  { value: "italian", label: "איטלקי", emoji: "🍝" },
  { value: "asian", label: "אסייתי", emoji: "🥢" },
  { value: "bbq", label: "בשרים ועל האש", emoji: "🍖" },
  { value: "burger_diner", label: "המבורגר ודיינר אמריקאי", emoji: "🍔" },
  { value: "mexican", label: "מקסיקני", emoji: "🌮" },
{ value: "greek", label: "יווני", emoji: "🫓" },
{ value: "french_bistro", label: "ביסטרו צרפתי", emoji: "🥖" },
  { value: "indian", label: "הודי", emoji: "🍛" },
  { value: "mediterranean", label: "ים־תיכוני", emoji: "🫒" },
  { value: "seafood", label: "דגים ופירות ים", emoji: "🐟" },
  { value: "pizza", label: "פיצה", emoji: "🍕" },
  { value: "brunch", label: "ארוחת בוקר ובראנץ'", emoji: "🥐" },
  { value: "cafe", label: "בית קפה", emoji: "☕" },
  { value: "sweets", label: "מאנצ'ים ומתוקים", emoji: "🍰" },
];

export const SURPRISE_ME_OPTION: StepOption = { value: "surprise_me", label: "תפתיע אותי", emoji: "🎁" };