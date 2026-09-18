interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

/**
 * לפני הקובץ הזה, נעשה שימוש ישיר ב-formatted_address של גוגל בתור
 * "label" לכתובת - זה כולל מיקוד ומדינה ("יגאל אלון 157א, תל אביב-יפו,
 * 6744365, ישראל"), ארוך מדי לשורת הכותרת/רשימת הכתובות. הפונקציה הזו
 * בונה label קצר במקום: רק "רחוב ומספר, עיר".
 */
export function buildShortAddressLabel(components: GoogleAddressComponent[] | undefined, fallback: string): string {
  if (!components || components.length === 0) return fallback;

  const find = (type: string) => components.find((c) => c.types.includes(type))?.long_name;

  const route = find("route");
  const streetNumber = find("street_number");
  const city = find("locality") ?? find("postal_town") ?? find("administrative_area_level_2");

  const streetPart = [route, streetNumber].filter(Boolean).join(" ");

  if (streetPart && city) return `${streetPart}, ${city}`;
  if (streetPart) return streetPart;
  if (city) return city;
  return fallback;
}
