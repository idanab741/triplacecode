import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** מוסיפה יעד חדש (בסיסי - שאר השדות מתמלאים בעריכה).
 *
 * תיקון Product מפורש ("תיצור מצב שאי אפשר ליצור יעד שכבר נוצר - או
 * לפחות שתכתב הודעה על כך"): בודקים לפי שם (case-insensitive, לא
 * תלוי רווחים מיותרים) אם כבר קיים יעד עם אותו שם לפני ההוספה - אם
 * כן, מחזירים 409 עם הודעה ברורה במקום ליצור כפילות. ר' הסבב הקודם -
 * מצאתי בפועל 84 מקומות כפולים ב-DB; זה חוסם את זה מהמקור, לא רק
 * מנקה אחרי מעשה.
 *
 * *** גם תיקנתי תוך כדי: ה-insert הישן ניסה לכתוב לעמודת "status" -
 * עמודה כזו **לא קיימת בכלל** בטבלת destinations (בדקתי ב-DB) - ה-
 * insert היה נכשל בשקט בכל קריאה. הוסר.
 */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name: string | undefined = body?.name?.trim();
  const country: string | undefined = body?.country;

  if (!name || !country) {
    return NextResponse.json({ error: "יש לספק name ו-country" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase.from("destinations").select("id,name,country").ilike("name", name).maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error: `כבר קיים יעד בשם "${existing.name}" (${existing.country ?? "לא צוינה מדינה"}) - לא נוצר כפול.`,
        existingDestination: existing,
      },
      { status: 409 }
    );
  }

  const { data, error } = await supabase.from("destinations").insert({ name, country }).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ destination: data });
}

/** מחזירה את כל היעדים, לתצוגה בעמוד האדמין. */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .order("created_at", { ascending: false })
    .range(0, 4999);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ destinations: data });
}
