import { NextResponse } from "next/server";
import { requireAdmin } from "@/services/admin/insights/core";

/**
 * חיפוש מיקום לאדמין (Google Places):
 * - ?q=...        השלמה אוטומטית - בלי הגבלת סוג, כך שגם חופים, תצפיות ואתרי טבע נמצאים
 * - ?placeId=...  פרטים מלאים: שם, כתובת, עיר, קואורדינטות
 */
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY אינו מוגדר" }, { status: 500 });

  const url = new URL(request.url);
  const placeId = url.searchParams.get("placeId");
  if (placeId) {
    const params = new URLSearchParams({ place_id: placeId, key: apiKey, language: "he", fields: "name,formatted_address,geometry,address_components" });
    const data = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`).then((r) => r.json());
    if (data.status !== "OK" || !data.result) return NextResponse.json({ error: "המקום לא נמצא" }, { status: 502 });
    const r = data.result;
    const city = (r.address_components as { long_name: string; types: string[] }[] | undefined)?.find((c) => c.types.includes("locality"))?.long_name ?? null;
    return NextResponse.json({
      placeId,
      name: r.name as string,
      address: r.formatted_address as string,
      city,
      latitude: r.geometry?.location?.lat as number,
      longitude: r.geometry?.location?.lng as number,
    });
  }

  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });
  const params = new URLSearchParams({ input: q, key: apiKey, language: "he" });
  const data = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`).then((r) => r.json());
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return NextResponse.json({ error: data.error_message ?? "החיפוש נכשל", suggestions: [] }, { status: 502 });
  }
  const suggestions = (data.predictions ?? []).map((p: { place_id: string; description: string; structured_formatting?: { main_text: string; secondary_text?: string } }) => ({
    placeId: p.place_id,
    mainText: p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? "",
  }));
  return NextResponse.json({ suggestions });
}
