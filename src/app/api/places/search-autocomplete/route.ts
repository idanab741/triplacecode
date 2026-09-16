import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * *** שינוי-שורש (בקשה מפורשת - "מה שאמור לצאת בחיפוש - זה רק מה
 * שיש לנו במאגר של TRIPADD, לא סתם דברים מגוגל"): לפני זה ה-route
 * הזה פנה ישירות ל-Google Places Autocomplete (כל עסק שגוגל מכיר,
 * בלי שום קשר למאגר שלנו) - עכשיו הוא מחפש אך ורק בתוך
 * tripadd_submissions, אותו מקור דאטה יחיד שכבר מזין את המפה
 * (/api/tripadd/pins) ואת עמוד האטרקציה (/place/[id]).
 *
 * *** תלוי ב-migration 0080 (RLS פתוח לכל משתמש מחובר על
 * tripadd_submissions, לא רק ליוצר) - בלעדיה, כל משתמש היה מקבל
 * כאן תוצאות רק מתוך המקומות שהוא עצמו הוסיף, לא כל הקהילה.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ suggestions: [] });

  const supabase = await createClient();

  // חיפוש בשם המקום *או* בכתובת/עיר - "חומוסייה" ימצא לפי שם, אבל גם
  // "תל אביב" ימצא כל מקום שהעיר/הכתובת שלו מכילות את זה. לא full-text
  // search ייעודי (לא קיים כרגע index כזה על הטבלה) - ILIKE מספיק
  // בהיקף הנוכחי של המאגר.
  // *** תיקון: פסיק בטקסט החיפוש היה שובר את תחביר ה-.or() של
  // PostgREST (הוא עצמו מפריד בין תנאים בפסיקים) - מוסר לפני הבנייה.
  const safeQuery = query.replace(/,/g, " ");

  const { data, error } = await supabase
    .from("tripadd_submissions")
    .select("id, name, category, subcategory, address, city")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .or(`name.ilike.%${safeQuery}%,address.ilike.%${safeQuery}%,city.ilike.%${safeQuery}%`)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) return NextResponse.json({ error: error.message, suggestions: [] }, { status: 500 });

  const suggestions = (data ?? []).map((p) => ({
    id: p.id,
    mainText: p.name,
    secondaryText: [p.subcategory, p.address ?? p.city].filter(Boolean).join(" · "),
  }));

  return NextResponse.json({ suggestions });
}
