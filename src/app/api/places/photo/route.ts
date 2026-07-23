import { NextResponse } from "next/server";

/**
 * פרוקסי לתמונות Google Places - מפתח ה-API נשאר בשרת בלבד, לא נחשף בדפדפן.
 * הדפדפן פונה לכתובת הזו (/api/places/photo?ref=...), והשרת שלנו מביא
 * את התמונה בפועל מגוגל ומעביר אותה הלאה.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref");
  const maxwidth = searchParams.get("maxwidth") ?? "800";

  if (!ref) {
    return NextResponse.json({ error: "יש לספק ref" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY אינו מוגדר" }, { status: 500 });
  }

  const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(
    ref
  )}&key=${apiKey}`;

  const response = await fetch(googleUrl);
  if (!response.ok || !response.body) {
    return NextResponse.json({ error: "לא הצלחנו להביא את התמונה" }, { status: 502 });
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}