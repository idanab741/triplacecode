import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";

type Feature = "main" | "tripmatch" | "tripbuilding";

const COLUMN_BY_FEATURE: Record<Feature, string> = {
  main: "main_onboarding_completed_at",
  tripmatch: "tripmatch_onboarding_completed_at",
  tripbuilding: "tripbuilding_onboarding_completed_at",
};

// Allows the app to keep working during rollout if migration 0014 has not
// reached a deployed database yet. The new columns remain the primary source.
const LEGACY_COLUMN_BY_FEATURE: Partial<Record<Feature, string>> = {
  main: "intro_completed_at",
  tripbuilding: "chat_onboarding_completed_at",
};

/** מסמנת שהמשתמש המחובר סיים/דילג על אחד מסוגי ה-Onboarding (הראשי, או
 *  אחד ממסכי ההסבר לפיצ'ר) - לפי `feature` בגוף הבקשה. נכתבת ל-DB (לא
 *  ל-localStorage) כדי שגם קוד שרץ בשרת (auth/callback) וגם מכשירים
 *  אחרים אחרי התחברות יידעו את זה.
 *
 *  משתמשים ב-admin client (service_role) לכתיבה עצמה, לא ב-client
 *  הרגיל - אחרת אם אין RLS policy מתאימה, העדכון "נכשל בשקט" (מחזיר
 *  success בלי לגעת בפועל בשום שורה) - זה בדיוק מה שגרם ללולאה
 *  האינסופית שכבר תיקנו פעם אחת. זיהוי המשתמש עדיין קורה מול ה-session
 *  הרגיל, כדי שרק המשתמש המחובר יוכל לסמן את *עצמו* כמסיים. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const feature: Feature = body?.feature && body.feature in COLUMN_BY_FEATURE ? body.feature : "main";
  const column = COLUMN_BY_FEATURE[feature];

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[onboarding/complete] createAdminClient failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
  // upsert (לא update) - מאותה סיבה כמו ב-updateProfile: אם שורת
  // ה-profiles חסרה (הטריגר לא רץ), update() היה "מצליח" ומחזיר 0
  // שורות בלי שגיאה - זה בדיוק מה שגרם למשתמשי Google/Apple להיתקע
  // כאן. upsert יוצר את השורה אם היא חסרה.
  let { data, error } = await admin
    .from("profiles")
    .upsert({ id: user.id, [column]: new Date().toISOString() })
    .select(`id, ${column}`);

  if (error && LEGACY_COLUMN_BY_FEATURE[feature]) {
    const legacyColumn = LEGACY_COLUMN_BY_FEATURE[feature];
    const legacy = await admin
      .from("profiles")
      .upsert({ id: user.id, [legacyColumn]: new Date().toISOString() })
      .select(`id, ${legacyColumn}`);
    data = legacy.data;
    error = legacy.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "לא נמצאה שורת פרופיל לעדכון" }, { status: 500 });
  }

  return NextResponse.json({ success: true, feature, profile: data[0] });
}
