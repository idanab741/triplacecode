import { NextResponse } from "next/server";

/**
 * *** נוצר תוך כדי תיקון רגרסיה: /api/places/search-autocomplete (הנתיב
 * הזה בדיוק) הוסב במלואו לחיפוש בתוך tripadd_submissions בלבד (בקשה
 * מפורשת - "רק ממאגר TRIPADD, לא סתם דברים מגוגל", ר' ההערה בקובץ
 * ההוא). אבל אותו נתיב שימש גם את AddPlaceModal.tsx בשביל שלב אחר
 * לגמרי: איתור מקום *חדש*, שעדיין לא קיים אצלנו בכלל, כדי לקבל ממנו
 * כתובת/קואורדינטות אמיתיות - שם השימוש ב-Google הוא לא רק לגיטימי
 * אלא הכרחי (אי אפשר "לחפש ב-TripAdd" מקום שעוד לא נוסף ל-TripAdd).
 * זה בדיוק אותו קוד שהיה קודם ב-search-autocomplete, רק תחת נתיב
 * ייעודי משלו - כדי ששני השימושים לא יתנגשו יותר על אותו endpoint.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  // *** תיקון עלויות: "תל", "פיצ" וכו' יוצרים המון קריאות בתשלום לגוגל
  // (כל אחת בתשלום, בלי session token) על כל הקלדה, עוד לפני שיש
  // מספיק טקסט לתוצאה שימושית. 3 תווים - כמו ב-address-autocomplete.
  if (query.length < 3) return NextResponse.json({ suggestions: [] });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY אינו מוגדר" }, { status: 500 });
  }

  const params = new URLSearchParams({
    input: query,
    key: apiKey,
    language: "he",
    types: "establishment",
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
  const data = await response.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return NextResponse.json({ error: data.error_message ?? "החיפוש נכשל", suggestions: [] }, { status: 502 });
  }

  const suggestions = (data.predictions ?? []).map((p: { place_id: string; structured_formatting?: { main_text: string; secondary_text?: string }; description: string }) => ({
    placeId: p.place_id,
    mainText: p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? "",
  }));

  return NextResponse.json({ suggestions });
}
