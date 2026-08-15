import { NextResponse } from "next/server";

/** השלמה אוטומטית כללית (מסעדות, אטרקציות, מקומות, פעילויות...) לשורת
 *  החיפוש בעמוד הבית - לא מוגבל לסוג "lodging" כמו /api/places/hotels.
 *  אותו דפוס בדיוק (המפתח נשאר בצד השרת). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ suggestions: [] });

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
