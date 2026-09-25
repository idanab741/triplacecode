import { NextResponse } from "next/server";
import type { MapArea } from "@/services/places/mapAreaTypes";

/**
 * *** בקשה מפורשת ("אם ארשום אתונה - המפה תראה לי את אתונה בתוך הגבולות של העיר, או איזה כפר - כנ"ל"):
 * מחזיר לאזור שנבחר בחיפוש את המרכז, התחום, ואם אפשר - את גבול העיר האמיתי.
 *  1. Google Place Details - שם, מרכז ותחום (viewport). תמיד קיים.
 *  2. OpenStreetMap (Nominatim) - גבול העיר כ-GeoJSON. בקשה אחת לבחירה (לא בכל הקשה - לפי תנאי
 *     השימוש של Nominatim), ומוודאים שהתוצאה באמת בתוך התחום של Google. אם אין - נשארים עם התחום.
 */
const NOMINATIM_UA = "TRIPLACE/1.0 (travel app; map area search)";

type LatLngLiteral = { lat: number; lng: number };

export async function GET(request: Request) {
  const placeId = new URL(request.url).searchParams.get("placeId")?.trim() ?? "";
  if (!placeId) return NextResponse.json({ error: "חסר placeId" }, { status: 422 });
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "החיפוש לא זמין כרגע" }, { status: 503 });

  const detailsParams = new URLSearchParams({ place_id: placeId, key: apiKey, language: "he", fields: "name,geometry,address_components" });
  const details = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${detailsParams}`)
    .then((r) => r.json())
    .catch(() => null);
  const result = details?.result;
  const location: LatLngLiteral | undefined = result?.geometry?.location;
  if (!result || !location) return NextResponse.json({ error: "לא מצאנו את המקום" }, { status: 404 });

  const viewport = result.geometry.viewport as { northeast: LatLngLiteral; southwest: LatLngLiteral } | undefined;
  const components = (result.address_components ?? []) as { long_name: string; short_name: string; types: string[] }[];
  const country = components.find((c) => c.types.includes("country"));
  const admin = components.find((c) => c.types.includes("administrative_area_level_1"));

  const area: MapArea = {
    name: result.name as string,
    subtitle: [admin?.long_name, country?.long_name].filter((v, i, a) => v && a.indexOf(v) === i && v !== result.name).join(", ") || null,
    center: location,
    bounds: viewport
      ? [
          [viewport.southwest.lat, viewport.southwest.lng],
          [viewport.northeast.lat, viewport.northeast.lng],
        ]
      : [
          [location.lat - 0.02, location.lng - 0.02],
          [location.lat + 0.02, location.lng + 0.02],
        ],
    boundary: null,
  };

  try {
    const q = new URLSearchParams({
      q: result.name as string,
      format: "jsonv2",
      polygon_geojson: "1",
      polygon_threshold: "0.0005",
      limit: "5",
      "accept-language": "he,en",
    });
    if (country?.short_name) q.set("countrycodes", country.short_name.toLowerCase());
    const candidates = (await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { "User-Agent": NOMINATIM_UA },
      signal: AbortSignal.timeout(6000),
    }).then((r) => (r.ok ? r.json() : []))) as { lat: string; lon: string; boundingbox?: string[]; geojson?: GeoJSON.Geometry }[];

    const [[s, w], [n, e]] = area.bounds;
    const pad = Math.max(n - s, e - w) * 0.5 + 0.02;
    const inside = (lat: number, lng: number) => lat >= s - pad && lat <= n + pad && lng >= w - pad && lng <= e + pad;
    const match = candidates.find(
      (c) => (c.geojson?.type === "Polygon" || c.geojson?.type === "MultiPolygon") && inside(Number(c.lat), Number(c.lon))
    );
    if (match?.geojson && (match.geojson.type === "Polygon" || match.geojson.type === "MultiPolygon")) {
      area.boundary = match.geojson;
      if (match.boundingbox?.length === 4) {
        const [bs, bn, bw, be] = match.boundingbox.map(Number);
        area.bounds = [
          [bs, bw],
          [bn, be],
        ];
      }
    }
  } catch {
    // Nominatim לא זמין - נשארים עם התחום של Google
  }

  return NextResponse.json({ area }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
