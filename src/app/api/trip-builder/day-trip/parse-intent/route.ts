import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { extractDayTripIntent } from "@/services/tripBuilder/dayTripIntentExtractionService";

/**
 * מחלץ תשובות מוכנות מראש מתוך המלל החופשי בתחילת שאלון "טיול יומי"
 * (בקשה מפורשת - המלל עבר להיות השאלה השנייה, מיד אחרי "מתי יוצאים") -
 * כדי שהצ'אט ידלג בהמשך על שאלות שכבר נענו בתוכו. אותו דפוס בדיוק כמו
 * /api/trip-builder/abroad-vacation/parse-intent.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const freeText = typeof body?.freeText === "string" ? body.freeText : "";

  if (!freeText.trim()) {
    return NextResponse.json({ error: "יש לספק freeText" }, { status: 400 });
  }

  const extracted = await extractDayTripIntent(freeText);
  return NextResponse.json({ extracted });
}
