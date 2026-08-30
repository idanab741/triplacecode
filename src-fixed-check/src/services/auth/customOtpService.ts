import crypto from "crypto";
import { createAdminClient } from "@/services/supabase/admin";

const CODE_LENGTH = 4;
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;

function hashCode(email: string, code: string): string {
  // *** חשוב: כולל את האימייל ב-hash (לא רק את הקוד) - מונע מצב שבו
  // שני משתמשים מקבלים אותו קוד 4-ספרות (סביר עם רק 10,000 צירופים
  // אפשריים) והיינו יכולים "לאמת" קוד של מישהו אחר בטעות.
  return crypto.createHash("sha256").update(`${email.toLowerCase().trim()}:${code}`).digest("hex");
}

function generateCode(): string {
  // 1000-9999 - תמיד בדיוק 4 ספרות (לא מתחיל באפס, כדי שלא "ייראה"
  // כמו 3 ספרות בטעות).
  return String(crypto.randomInt(1000, 10000));
}

/**
 * שולח קוד אימות בן 4 ספרות לאימייל, דרך Resend (https://resend.com).
 * דורש RESEND_API_KEY ב-env - ר' הערה ב-README/PR שמסביר את זה. בלי
 * המפתח הזה, הפונקציה זורקת שגיאה ברורה במקום להיכשל בשקט.
 */
export async function sendCustomSignupOtp(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const normalizedEmail = email.toLowerCase().trim();

  // *** הגבלת קצב בסיסית - לא שולחים קוד חדש אם קוד לא-פג-תוקף כבר
  // נשלח לאותו אימייל ב-30 השניות האחרונות (מונע ספאם/הצפת תיבת דואר).
  const { data: recent } = await admin
    .from("custom_otp_codes")
    .select("created_at")
    .eq("email", normalizedEmail)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent && Date.now() - new Date(recent.created_at as string).getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    return { ok: false, error: "קוד כבר נשלח לאחרונה - נסו שוב בעוד כמה שניות." };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await admin.from("custom_otp_codes").insert({
    email: normalizedEmail,
    code_hash: hashCode(normalizedEmail, code),
    expires_at: expiresAt,
  });
  if (insertError) {
    console.error("[customOtpService] שגיאה בשמירת קוד אימות", { message: insertError.message });
    return { ok: false, error: "שגיאה פנימית - נסו שוב." };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    // *** כשל ברור ומיידי (אותו עיקרון כמו createAdminClient) - עדיף
    // הודעה מפורשת בלוג עכשיו מאשר "האימייל פשוט לא הגיע" בלי הסבר.
    console.error("[customOtpService] RESEND_API_KEY חסר - לא ניתן לשלוח מייל אימות. ר' הוראות הגדרה ב-PR.");
    return { ok: false, error: "שליחת מייל אינה מוגדרת כרגע בשרת." };
  }

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "triplace <onboarding@resend.dev>",
      to: [normalizedEmail],
      subject: `${code} הוא קוד האימות שלך ל-triplace`,
      html: `<div dir="rtl" style="font-family:sans-serif;text-align:center;padding:24px">
        <p style="font-size:15px;color:#333">קוד האימות שלך:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#111">${code}</p>
        <p style="font-size:13px;color:#888">הקוד בתוקף ל-${CODE_TTL_MINUTES} דקות.</p>
      </div>`,
    }),
  });

  if (!emailRes.ok) {
    const body = await emailRes.text().catch(() => "");
    console.error("[customOtpService] שליחת המייל דרך Resend נכשלה", { status: emailRes.status, body });
    return { ok: false, error: "שליחת המייל נכשלה - נסו שוב." };
  }

  return { ok: true };
}

/**
 * מאמת קוד 4 ספרות. בהצלחה, מייצר session **אמיתי** דרך מנגנון ה-
 * Session Issuance המובנה של Supabase עצמו (לא ממציא JWT בעצמנו):
 * admin.generateLink({type:"magiclink"}) מייצר hashed_token תקין, שהלקוח
 * יכול להחליף ל-session אמיתי דרך supabase.auth.verifyOtp({token_hash,
 * type:"magiclink"}) - בדיוק כמו שהיה קורה אם המשתמש היה לוחץ על קישור
 * במייל אמיתי מ-Supabase, רק שכאן אנחנו מייצרים את ה-hashed_token אחרי
 * שאימתנו את הקוד המותאם-אישית שלנו, לא את קוד ה-6-ספרות של Supabase.
 */
export async function verifyCustomSignupOtp(
  email: string,
  code: string
): Promise<{ ok: true; tokenHash: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const normalizedEmail = email.toLowerCase().trim();

  const { data: row, error: selectError } = await admin
    .from("custom_otp_codes")
    .select("id,code_hash,attempts,expires_at,consumed_at")
    .eq("email", normalizedEmail)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError || !row) {
    return { ok: false, error: "לא נמצא קוד פעיל - בקשו קוד חדש." };
  }
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: "הקוד פג תוקף - בקשו קוד חדש." };
  }
  if ((row.attempts as number) >= MAX_ATTEMPTS) {
    return { ok: false, error: "יותר מדי ניסיונות שגויים - בקשו קוד חדש." };
  }

  if (row.code_hash !== hashCode(normalizedEmail, code.trim())) {
    await admin
      .from("custom_otp_codes")
      .update({ attempts: (row.attempts as number) + 1 })
      .eq("id", row.id as string);
    return { ok: false, error: "קוד שגוי." };
  }

  await admin.from("custom_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id as string);

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: normalizedEmail,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    console.error("[customOtpService] generateLink נכשל", { message: linkError?.message });
    return { ok: false, error: "שגיאה פנימית באימות - נסו שוב." };
  }

  return { ok: true, tokenHash: linkData.properties.hashed_token };
}
