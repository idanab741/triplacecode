export function resolveTripCalendarDate(answers: Record<string, unknown> | null | undefined): string {
  const timing = answers?.timing as string | undefined;
  const otherDate = answers?.otherDate as string | null | undefined;

  function toIso(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
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