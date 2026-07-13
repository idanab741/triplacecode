import { NextRequest, NextResponse } from "next/server";

/**
 * מציג תמונות Google Places בלי לחשוף את מפתח ה-API ללקוח.
 * מקבל ref (שם משאב התמונה של גוגל) ומזרים את התמונה עצמה מהשרת.
 */
export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref) {
    return new NextResponse("Missing ref", { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const googleUrl = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=800&key=${apiKey}`;
  const response = await fetch(googleUrl);

  if (!response.ok) {
    return new NextResponse("Image not found", { status: 404 });
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const buffer = await response.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
