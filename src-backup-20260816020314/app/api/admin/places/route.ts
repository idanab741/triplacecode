import { NextResponse } from "next/server";
import { collectSinglePlaceByName } from "@/services/places/collectSinglePlace";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** מוסיפה מקום בודד לפי שם. */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name: string | undefined = body?.name;

  if (!name) {
    return NextResponse.json({ error: "יש לספק name" }, { status: 400 });
  }

  try {
    const result = await collectSinglePlaceByName(name);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** מחזירה את כל המקומות הקיימים, לתצוגה בעמוד האדמין. */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ברירת מחדל: רק מקומות שאינם "ישן" (is_legacy) - מקומות שכבר היו
  // קיימים לפני שיפוץ המערכת. ?includeLegacy=1 מציג הכל (משמש בעמוד
  // הארכיון /admin/places-archive).
  const url = new URL(request.url);
  const includeLegacy = url.searchParams.get("includeLegacy") === "1";
  // ?namesOnly=1 - מחזיר רק id+name (בלי שאר השדות הכבדים - תמונות, תגיות
  // וכו'). משמש למסכים שרק מציגים רשימת שמות לעיון (כמו "יעדים ומקומות"),
  // כדי לא לגרור אלפי רשומות מלאות כשצריך רק את השם.
  const namesOnly = url.searchParams.get("namesOnly") === "1";

  const supabase = createAdminClient();
  let query = supabase
    .from("places")
    .select(namesOnly ? "id, name" : "*")
    .order("created_at", { ascending: false })
    .range(0, 4999);
  if (!includeLegacy) query = query.eq("is_legacy", false);
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ places: data });
}