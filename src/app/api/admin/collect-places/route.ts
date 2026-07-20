import { NextResponse } from "next/server";
import { collectPlacesForCityAndCategory } from "@/services/places/collectionService";

/**
 * נקודת קצה לאדמין בלבד, מפעילה איסוף יעדים מ-Google Places.
 * הגנה זמנית: מפתח סודי בכותרת x-admin-secret, מול ADMIN_API_SECRET ב-.env.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

const body = await request.json().catch(() => null);
  const city: string | undefined = body?.city;
  const category: string | undefined = body?.category;
  const country: string | undefined = body?.country;
  const subTagQuery: string | undefined = body?.subTagQuery;
  const subTagId: string | undefined = body?.subTagId;

  if (!city || !category) {
    return NextResponse.json({ error: "יש לספק city ו-category" }, { status: 400 });
  }

  try {
    const result = await collectPlacesForCityAndCategory(city, category, country, subTagQuery, subTagId);
    return NextResponse.json(result);
} catch (error) {
  console.error(error);

  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: "Unknown error" },
    { status: 500 }
  );
}
