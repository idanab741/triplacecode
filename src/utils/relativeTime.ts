/** זמן יחסי בעברית, לתצוגה במרכז הפעילות (MASTER PROMPT סעיף 33 -
 *  "אין להציג ISO timestamp למשתמש"). */
export function formatRelativeTimeHe(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דקות`;
  if (hours === 1) return "לפני שעה";
  if (hours < 24) return `לפני ${hours} שעות`;
  if (days === 1) return "אתמול";
  if (days < 7) return `לפני ${days} ימים`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "לפני שבוע";
  if (days < 30) return `לפני ${weeks} שבועות`;
  const months = Math.floor(days / 30);
  if (months <= 1) return "לפני חודש";
  return `לפני ${months} חודשים`;
}
