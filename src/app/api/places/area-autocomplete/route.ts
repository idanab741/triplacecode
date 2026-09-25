import { NextResponse } from "next/server";
import type { AreaSuggestion } from "@/services/places/mapAreaTypes";

/** הצעות ערים / כפרים / אזורים לשורת החיפוש של מפת place's (Google Places Autocomplete, (regions)). */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ suggestions: [] });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ suggestions: [] });

  const params = new URLSearchParams({ input: query, key: apiKey, language: "he", types: "(regions)" });
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
    const data = await res.json();
    const suggestions: AreaSuggestion[] = (data.predictions ?? [])
      .slice(0, 4)
      .map((p: { place_id: string; description: string; structured_formatting?: { main_text: string; secondary_text?: string } }) => ({
        placeId: p.place_id,
        mainText: p.structured_formatting?.main_text ?? p.description,
        secondaryText: p.structured_formatting?.secondary_text ?? "",
      }));
    return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
