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
  // ?q= - חיפוש חופשי בשם (ilike), ו-?city= - סינון לפי עיר. שני אלה
  // נוספו עבור "הוסף אטרקציה קיימת" בפאנל העריכה של Admin Places
  // (/admin/place-console) - חיפוש ממוקד במאגר במקום למשוך עד 5000
  // שורות בכל הקלדה. לא משפיע על אף קורא קיים של ה-route הזה, כי
  // ברירת המחדל (בלי הפרמטרים) נשארת זהה לגמרי.
  const q = url.searchParams.get("q")?.trim();
  const city = url.searchParams.get("city")?.trim();
  // ?category= - סינון לפי אחת מ-5 הקטגוריות הראשיות (places.category).
  // נוסף עבור התצוגה החיה של אטרקציות ב-Admin Places עבור סוגי הטיול
  // שאין להם "יעד" קבוע (טיול יומי/טבע/מסעדות וקפה/דייט רומנטי/חיי
  // לילה) - שם מציגים את האטרקציות עצמן במקום כרטיסי יעד.
  const category = url.searchParams.get("category")?.trim();

  const supabase = createAdminClient();
  let query = supabase
    .from("places")
    .select(namesOnly ? "id, name" : "*")
    .order("created_at", { ascending: false })
    .range(0, 4999);
  if (!includeLegacy) query = query.eq("is_legacy", false);
  if (q) query = query.ilike("name", `%${q}%`);
  if (city) query = query.ilike("city", `%${city}%`);
  if (category) query = query.eq("category", category);
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ places: data });
}