import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";

/**
 * *** שינוי-שורש (בקשה מפורשת - "מה שאמור לצאת בחיפוש - זה רק מה
 * שיש לנו במאגר של TRIPADD, לא סתם דברים מגוגל"): לפני זה ה-route
 * הזה פנה ישירות ל-Google Places Autocomplete (כל עסק שגוגל מכיר,
 * בלי שום קשר למאגר שלנו) - עכשיו הוא מחפש אך ורק בתוך
 * tripadd_submissions, אותו מקור דאטה יחיד שכבר מזין את המפה
 * (/api/tripadd/pins) ואת עמוד האטרקציה (/place/[id]).
 *
 * *** תוספת (בקשה מפורשת - "גם היעדים החדשים שהוספנו ב-Admin Places
 * צריכים להימצא בחיפוש, כמו האטרקציות"): מקור שני, נפרד - הטבלה
 * הישנה `places` (Admin Places) - עדיין **בלי שום קריאת Google**,
 * רק ILIKE על שם/עיר שכבר קיים ב-DB. admin client (לא regular) - כדי
 * שזה יעבוד בוודאות לכל משתמש בלי תלות במדיניות RLS של הטבלה הישנה
 * (שלא נבדקה/לא מובטחת פתוחה כמו tripadd_submissions).
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
  const adminSupabase = createAdminClient();

  // חיפוש בשם המקום *או* בכתובת/עיר - "חומוסייה" ימצא לפי שם, אבל גם
  // "תל אביב" ימצא כל מקום שהעיר/הכתובת שלו מכילות את זה. לא full-text
  // search ייעודי (לא קיים כרגע index כזה על הטבלה) - ILIKE מספיק
  // בהיקף הנוכחי של המאגר.
  // *** תיקון: פסיק בטקסט החיפוש היה שובר את תחביר ה-.or() של
  // PostgREST (הוא עצמו מפריד בין תנאים בפסיקים) - מוסר לפני הבנייה.
  const safeQuery = query.replace(/,/g, " ");

  const [tripAddRes, adminPlacesRes] = await Promise.all([
    supabase
      .from("tripadd_submissions")
      .select("id, name, category, subcategory, address, city")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .or(`name.ilike.%${safeQuery}%,address.ilike.%${safeQuery}%,city.ilike.%${safeQuery}%`)
      .order("created_at", { ascending: false })
      .limit(6),
    adminSupabase
      .from("places")
      .select("id, name, city")
      .eq("is_legacy", false)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .or(`name.ilike.%${safeQuery}%,city.ilike.%${safeQuery}%`)
      .limit(4),
  ]);

  if (tripAddRes.error) return NextResponse.json({ error: tripAddRes.error.message, suggestions: [] }, { status: 500 });

  const suggestions = [
    ...(tripAddRes.data ?? []).map((p) => ({
      id: p.id,
      mainText: p.name,
      secondaryText: [p.subcategory, p.address ?? p.city].filter(Boolean).join(" · "),
    })),
    ...(adminPlacesRes.data ?? []).map((p) => ({
      id: p.id,
      mainText: p.name,
      secondaryText: p.city ?? "",
    })),
  ];

  return NextResponse.json({ suggestions });
}
