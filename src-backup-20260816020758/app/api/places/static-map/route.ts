import { NextResponse } from "next/server";

/** מפה סטטית לפי קואורדינטות חופשיות (לא קשור למקום ב-DB שלנו) - לעמוד
 *  תוצאת חיפוש של מקום שנמצא ב-Google אבל לא בהכרח קיים אצלנו ב-places.
 *  אותו דפוס כמו /api/places/[id]/map-preview - המפתח נשאר בצד השרת. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "יש לספק lat ו-lng" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "מפתח מפות לא מוגדר" }, { status: 500 });
  }

  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: "15",
    size: "640x320",
    scale: "2",
    maptype: "roadmap",
    markers: `color:0x1b6fe8|${lat},${lng}`,
    key: apiKey,
  });

  const mapResponse = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params}`);
  if (!mapResponse.ok) {
    return NextResponse.json({ error: "טעינת מפה נכשלה" }, { status: 502 });
  }

  const imageBuffer = await mapResponse.arrayBuffer();
  return new NextResponse(imageBuffer, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}
