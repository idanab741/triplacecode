import type { TrippyQuickStop } from "@/services/tripBuilder/trippyQuickShared";

/** מפיק ומוריד קובץ .ics עצמאי (בלי session/DB) עם אירוע נפרד לכל
 *  תחנה, ברצף, החל מ-09:00 ביום שנבחר - כל תחנה 90 דקות. תומך ב-
 *  Google/Apple/Outlook Calendar בלחיצה אחת על הקובץ שיורד. */
export function downloadIcsFile(stops: TrippyQuickStop[], dateIso: string, title: string) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const STOP_DURATION_MIN = 90;

  function pad(n: number) {
    return String(n).padStart(2, "0");
  }

  function toIcsDateTime(hour: number, minute: number): string {
    return `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`;
  }

  const events = stops.map((stop, index) => {
    const startMinutesFromNine = index * STOP_DURATION_MIN;
    const startHour = 9 + Math.floor(startMinutesFromNine / 60);
    const startMinute = startMinutesFromNine % 60;
    const endMinutesFromNine = startMinutesFromNine + STOP_DURATION_MIN;
    const endHour = 9 + Math.floor(endMinutesFromNine / 60);
    const endMinute = endMinutesFromNine % 60;

    const description = stop.shortDescription ?? "";
    const location = stop.address ?? "";

    return [
      "BEGIN:VEVENT",
      `UID:${stop.id}@triplace`,
      `DTSTART:${toIcsDateTime(startHour, startMinute)}`,
      `DTEND:${toIcsDateTime(endHour, endMinute)}`,
      `SUMMARY:${stop.name}`,
      description ? `DESCRIPTION:${description.replace(/\n/g, "\\n")}` : "",
      location ? `LOCATION:${location}` : "",
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });

  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TRIPLACE//Trippy Quick//HE", ...events, "END:VCALENDAR"].join(
    "\r\n"
  );

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title || "trippy-day"}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
