import { INTERESTS } from "@/locales/he/preferences";

/** תוויות לקטגוריות שאינן חלק מרשימת INTERESTS של ההעדפות. */
const EXTRA_CATEGORY_LABELS: Record<string, string> = {
  attractions: "אטרקציות",
  hotels: "מלונות",
};

export function getCategoryLabel(categoryId: string): string {
  const found = INTERESTS.find((option) => option.value === categoryId);
  if (found) return found.label;
  return EXTRA_CATEGORY_LABELS[categoryId] ?? categoryId;
}
