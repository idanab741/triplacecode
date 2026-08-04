import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/** מסמנת שהמשתמש המחובר סיים/דילג על סיור ה-Onboarding. נכתבת ל-DB
 *  (לא רק ל-localStorage) כדי ש-/auth/callback/route.ts - שרץ בשרת - יוכל
 *  לדעת את זה גם הוא, ולא רק קוד שרץ בדפדפן. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { error } = await supabase
    .from("profiles")
    .update({ intro_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
