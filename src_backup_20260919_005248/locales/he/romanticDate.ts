import type { StepOption } from "@/services/tripBuilder/types";

export const DATE_WITH_OPTIONS: StepOption[] = [
  { value: "partner", label: "בן/בת זוג", emoji: "💑" },
  { value: "first_date", label: "דייט ראשון", emoji: "✨" },
  { value: "multiple_dates", label: "כמה דייטים", emoji: "😊" },
  { value: "anniversary", label: "יום נישואין", emoji: "💍" },
  { value: "proposal", label: "הצעת נישואין", emoji: "💎" },
  { value: "special_event", label: "אירוע מיוחד", emoji: "🎉" },
];

export const ROMANTIC_TIMING_OPTIONS: StepOption[] = [
  { value: "today", label: "היום" },
  { value: "tomorrow", label: "מחר" },
  { value: "other_date", label: "תאריך אחר" },
];

export const ROMANTIC_DISTANCE_STEPS: StepOption[] = [
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

export const ROMANTIC_BUDGET_STEPS: StepOption[] = [
  { value: "0-100", label: "₪0‑100" },
  { value: "100-300", label: "₪100‑300" },
  { value: "300-600", label: "₪300‑600" },
  { value: "600-1000", label: "₪600‑1,000" },
  { value: "unlimited", label: "ללא הגבלה" },
];

export const DATE_TYPE_OPTIONS: StepOption[] = [
  { value: "romantic_meal", label: "ארוחה רומנטית", emoji: "🍽️" },
  { value: "sunset_view", label: "שקיעה ונוף", emoji: "🌅" },
  { value: "beach", label: "חוף ים", emoji: "🏖️" },
  { value: "winery_bar", label: "יקב או בר יין", emoji: "🍷" },
  { value: "cafe", label: "בית קפה", emoji: "☕" },
  { value: "culture_show", label: "תרבות והופעה", emoji: "🎭" },
  { value: "couples_workshop", label: "סדנה זוגית", emoji: "🎨" },
  { value: "spa", label: "ספא", emoji: "🧖" },
  { value: "night_out", label: "בילוי לילי", emoji: "🌃" },
];

export const ROMANTIC_SURPRISE_ME_OPTION: StepOption = { value: "surprise_me", label: "תפתיעו אותנו", emoji: "🎁" };