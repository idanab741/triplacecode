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

  if (!city || !category) {
    return NextResponse.json({ error: "יש לספק city ו-category" }, { status: 400 });
  }

  try {
    const result = await collectPlacesForCityAndCategory(city, category);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
