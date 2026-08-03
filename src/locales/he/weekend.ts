import type { StepOption } from "@/services/tripBuilder/types";

export const WEEKEND_STYLE_OPTIONS: StepOption[] = [
  { value: "relax", label: "בטן־גב", emoji: "🏖️" },
  { value: "nature_adventure", label: "טבע והרפתקאות", emoji: "🌿" },
  { value: "shopping", label: "שופינג", emoji: "🛍️" },
  { value: "sports_extreme", label: "ספורט ואקסטרים", emoji: "🚴" },
  { value: "culinary", label: "קולינריה ואוכל", emoji: "🍽️" },
  { value: "spa_wellness", label: "בריאות, ספא ווולנס", emoji: "🧖" },
  { value: "culture_art", label: "תרבות, אמנות והיסטוריה", emoji: "🎭" },
  { value: "family", label: "משפחתי", emoji: "👨‍👩‍👧‍👦" },
  { value: "romantic", label: "רומנטי", emoji: "💑" },
  { value: "nightlife", label: "חיי לילה ובילויים / אינסטגרמי", emoji: "📸" },
];

export const WEEKEND_BUDGET_STEPS: StepOption[] = [
  { value: "0-1000", label: "₪0-1,000" },
  { value: "1000-3000", label: "₪1,000-3,000" },
  { value: "3000+", label: "מעל ₪3,000" },
  { value: "unlimited", label: "ללא הגבלה" },
];

export const WEEKEND_STYLE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  WEEKEND_STYLE_OPTIONS.map((option) => [option.value, option.label])
);

export function getWeekendStyleLabel(value: string): string {
  return WEEKEND_STYLE_LABEL_MAP[value] ?? value;
}
