import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { extractVacationIntent } from "@/services/tripBuilder/vacationIntentExtractionService";

/**
 * מחלץ תשובות מוכנות מראש מתוך המלל החופשי הפתוח בתחילת שאלון "חופשה
 * בחו\"ל" ("ספרו לי על החופשה שאתם מדמיינים") - כדי שהצ'אט ידלג בהמשך
 * על שאלות שכבר נענו בתוך המלל. משמש גם את "בואו נבנה יחד" (לדילוג על
 * שלבים) וגם את "אמשיך לבד" (כדי לדעת אם צוין יעד מפורש, לפני שנופלים
 * חזרה ל"תפתיעו אותי").
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

  const extracted = await extractVacationIntent(freeText);
  return NextResponse.json({ extracted });
}
