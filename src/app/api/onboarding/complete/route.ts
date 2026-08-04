import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";

/** מסמנת שהמשתמש המחובר סיים/דילג על סיור ה-Onboarding. נכתבת ל-DB
 *  (לא רק ל-localStorage) כדי ש-/auth/callback/route.ts - שרץ בשרת - יוכל
 *  לדעת את זה גם הוא, ולא רק קוד שרץ בדפדפן.
 *
 *  משתמשים ב-admin client (service_role) לכתיבה עצמה - לא ב-client
 *  הרגיל של המשתמש - כי אם אין RLS policy שמתירה למשתמש לעדכן את
 *  עמודת intro_completed_at בשורת ה-profiles שלו, העדכון עם ה-client
 *  הרגיל "נכשל בשקט": מחזיר error:null אבל בפועל לא נוגע באף שורה
 *  (RLS פשוט מסנן את השורה בלי לזרוק שגיאה) - וזה בדיוק גורם ללולאה
 *  האינסופית חזרה ל-/onboarding. זיהוי המשתמש עדיין קורה מול ה-session
 *  הרגיל, כדי שרק המשתמש המחובר יוכל לסמן את *עצמו* כמסיים. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({ intro_completed_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("id, intro_completed_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    // אין שגיאה, אבל גם אף שורה לא עודכנה - כנראה שאין שורת profiles
    // בכלל למשתמש הזה (מקרה קצה נדיר, למשל אם profile-setup לא הושלם
    // כראוי). מחזירים שגיאה ברורה במקום להעמיד פנים שהצליח.
    return NextResponse.json({ error: "לא נמצאה שורת פרופיל לעדכון" }, { status: 500 });
  }

  return NextResponse.json({ success: true, profile: data[0] });
}
