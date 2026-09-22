/** ממפה קוד מזג אוויר של WMO (מ-Open-Meteo) לתווית ואייקון בעברית. */
export function describeWeatherCode(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: "בהיר", emoji: "☀️" };
  if (code <= 2) return { label: "מעונן חלקית", emoji: "🌤️" };
  if (code === 3) return { label: "מעונן", emoji: "☁️" };
  if (code === 45 || code === 48) return { label: "ערפילי", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "טפטוף", emoji: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "גשום", emoji: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "שלג", emoji: "❄️" };
  if (code >= 80 && code <= 82) return { label: "ממטרים", emoji: "🌧️" };
  if (code >= 95) return { label: "סופות רעמים", emoji: "⛈️" };
  return { label: "לא ידוע", emoji: "🌡️" };
}

const HEBREW_WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export function formatHebrewWeekday(isoDate: string): string {
  const day = new Date(isoDate).getDay();
  return HEBREW_WEEKDAYS[day];
}
