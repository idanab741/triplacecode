import { NextResponse } from "next/server";

/** מחשב זמן נסיעה אמיתי (בדקות) בין המיקום הנוכחי ליעד, דרך Distance Matrix API. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const originLat = body?.originLat;
  const originLng = body?.originLng;
  const destLat = body?.destLat;
  const destLng = body?.destLng;

  if (
    typeof originLat !== "number" ||
    typeof originLng !== "number" ||
    typeof destLat !== "number" ||
    typeof destLng !== "number"
  ) {
    return NextResponse.json({ error: "קואורדינטות חסרות" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ minutes: null }, { status: 200 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", `${originLat},${originLng}`);
  url.searchParams.set("destinations", `${destLat},${destLng}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("language", "he");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  const data = await response.json();

  const element = data?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    return NextResponse.json({ minutes: null });
  }

  const minutes = Math.round(element.duration.value / 60);
  return NextResponse.json({ minutes });
}
