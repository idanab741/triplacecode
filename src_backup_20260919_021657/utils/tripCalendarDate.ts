export function resolveTripCalendarDate(answers: Record<string, unknown> | null | undefined): string {
  const timing = answers?.timing as string | undefined;
  const otherDate = answers?.otherDate as string | null | undefined;
  // abroad-vacation ו-weekend לא משתמשים ב-timing/otherDate בצ'אט - הם אוספים
  // טווח תאריכים (startDate/endDate) ישירות - צריך להשתמש בתאריך ההתחלה שלהם.
  const startDate = answers?.startDate as string | undefined;

  function toIso(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  if (startDate) {
    return startDate;
  }

  if (timing === "other_date" && otherDate) {
    return otherDate;
  }

  const today = new Date();
  if (timing === "tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toIso(tomorrow);
  }

  return toIso(today);
}