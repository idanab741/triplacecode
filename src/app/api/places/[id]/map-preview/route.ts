import { NextResponse } from "next/server";
import { getPlaceById } from "@/services/places/placesServerService";

/** מחזירה תמונת מפה סטטית (Google Static Maps) עבור מקום - ה-API key
 *  (GOOGLE_MAPS_API_KEY, ללא NEXT_PUBLIC_) נשאר בצד השרת בלבד; לא נחשף
 *  בשום URL שהדפדפן רואה. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const place = await getPlaceById(id);

  if (!place) {
    return NextResponse.json({ error: "מקום לא נמצא" }, { status: 404 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "מפתח מפות לא מוגדר" }, { status: 500 });
  }

  const params_ = new URLSearchParams({
    center: `${place.latitude},${place.longitude}`,
    zoom: "14",
    size: "640x320",
    scale: "2",
    maptype: "roadmap",
    markers: `color:0x1b6fe8|${place.latitude},${place.longitude}`,
    key: apiKey,
  });

  const mapResponse = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params_}`);
  if (!mapResponse.ok) {
    const body = await mapResponse.text().catch(() => "");
    console.error(`[map-preview] Google Static Maps failed: ${mapResponse.status} - ${body}`);
    return NextResponse.json({ error: `טעינת מפה נכשלה: ${body || mapResponse.status}` }, { status: 502 });
  }

  const imageBuffer = await mapResponse.arrayBuffer();
  return new NextResponse(imageBuffer, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}
