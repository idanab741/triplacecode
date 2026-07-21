const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export interface DayHours {
  openMinutes: number;
  closeMinutes: number;
}

/** מפענח מערך תיאורי שעות פתיחה (מגוגל, בעברית) ליום ספציפי בשבוע (0=ראשון...6=שבת). */
export function parseOpeningHoursForDay(hours: string[] | null, dayOfWeek: number): DayHours | "closed" | null {
  if (!hours || hours.length === 0) return null;
  const dayName = HEBREW_DAYS[dayOfWeek];
  const line = hours.find((h) => h.includes(dayName));
  if (!line) return null;
  if (line.includes("סגור")) return "closed";

  const match = line.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const [, oh, om, ch, cm] = match;
  return {
    openMinutes: Number(oh) * 60 + Number(om),
    closeMinutes: Number(ch) * 60 + Number(cm),
  };
}

/** קובע את יום השבוע (0-6) של הטיול, לפי בחירת "מתי" בשאלון. */
export function getTripDayOfWeek(timing: string, otherDate: string | null): number {
  if (timing === "other_date" && otherDate) {
    return new Date(otherDate).getDay();
  }
  const now = new Date();
  if (timing === "tomorrow") now.setDate(now.getDate() + 1);
  return now.getDay();
}

export function minutesToTimeLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}