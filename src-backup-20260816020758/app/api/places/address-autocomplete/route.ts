import { NextResponse } from "next/server";

/** השלמה אוטומטית לכתובות מלאות (רחוב+מספר, לא רק ערים) - להוספת כתובת
 *  חדשה בבחירת מיקום. המפתח נשאר בצד השרת. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return NextResponse.json({ predictions: [] });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "מפתח מפות לא מוגדר" }, { status: 500 });
  }

  const params = new URLSearchParams({
    input: query,
    key: apiKey,
    language: "he",
    types: "address",
    components: "country:il",
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
  const data = await response.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return NextResponse.json({ error: data.error_message ?? "חיפוש כתובות נכשל" }, { status: 502 });
  }

  const predictions = (data.predictions ?? []).map((p: { place_id: string; description: string }) => ({
    placeId: p.place_id,
    description: p.description,
  }));

  return NextResponse.json({ predictions });
}
