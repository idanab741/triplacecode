import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { sendCustomSignupOtp } from "@/services/auth/customOtpService";

/**
 * תיקון Product מפורש ("קוד אימות ב-4 ספרות"): יצירת המשתמש עוברת כאן
 * (admin.createUser, לא supabase.auth.signUp מהלקוח) בכוונה - כדי
 * למנוע Duplicate email מבלבל. אם היינו משאירים את היצירה ב-
 * supabase.auth.signUp הרגיל, Supabase היה שולח **גם** את מייל האימות
 * המובנה שלו (6 ספרות, קבוע - לא ניתן לביטול ברמת הבקשה הבודדת) לצד
 * המייל המותאם-אישית שלנו (4 ספרות) - שני מיילים סותרים לאותה הרשמה.
 * admin.createUser לא שולח שום מייל אוטומטי, כך שרק המייל שלנו (4
 * ספרות) יוצא בפועל.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  const password = typeof body?.password === "string" ? body.password : null;
  if (!email || !password) {
    return NextResponse.json({ error: "פרטים חסרים." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  });

  if (createError) {
    // "already been registered"/"already exists" - אותה משמעות בפועל
    // כמו השגיאה ש-supabase.auth.signUp היה מחזיר, translateAuthError
    // בצד הלקוח כבר יודע לתרגם אותה.
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const otpResult = await sendCustomSignupOtp(email);
  if (!otpResult.ok) {
    return NextResponse.json({ error: otpResult.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
