/** מפתח יום מקומי (YYYY-M-D) - לקיבוץ הודעות לפי יום */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** כותרת מפריד היום בצ'אט: היום · אתמול · יום שלישי (בשבוע האחרון) · 12 בספטמבר (· 2025 אם שנה אחרת) */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days === 0) return "היום";
  if (days === 1) return "אתמול";
  if (days > 1 && days < 7) return new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(d);
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  }).format(d);
}

/** שעת ההודעה - 24 שעות, למשל 09:41 */
export function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
