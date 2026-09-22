import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ניקוי מלא של כל הטבלאות שמצביעות על user_id/id של משתמש, לפני מחיקת
 * auth.users עצמו (Postgres מסרב למחוק שורה כל עוד יש FK שמצביע אליה,
 * אלא אם יש ON DELETE CASCADE מוגדר - ולא בכל הטבלאות יש).
 *
 * *** מקור אמת יחיד: גם /api/profile/delete-account (מחיקה עצמית של
 * המשתמש) וגם /api/admin/users/[id] (מחיקה ע"י Admin) קוראים לפונקציה
 * הזו - כדי ששתי הדרכים למחוק משתמש תמיד ינקו בדיוק את אותן טבלאות,
 * ולא יתפצלו עם הזמן (בדיוק המצב שהיה קיים בפועל: הגרסה המקורית של
 * delete-account נכתבה *לפני* שנוספו support_conversations/
 * token_transactions/trippy_ai_results, ואף פעם לא עודכנה - כל מחיקה
 * עצמית השאירה orphan rows שם. תוקן כאן, במקום אחד).
 *
 * כל מחיקה עטופה בנפרד (safeDelete) כדי שטבלה אחת שנכשלת/לא קיימת לא
 * תעצור את כל התהליך - כל שגיאה נאספת ומוחזרת בסוף כ-warnings.
 */
export async function deleteUserCompletely(admin: SupabaseClient, userId: string): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];

  async function safeDelete(label: string, run: () => PromiseLike<{ error: { message: string } | null }>) {
    try {
      const { error } = await run();
      if (error) warnings.push(`${label}: ${error.message}`);
    } catch (e) {
      warnings.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // תלויות עם FK ל-session/conversation (לא ישירות ל-user) - חייבות
  // להימחק לפני השורה שמכילה אותן.
  const { data: sessions } = await admin.from("trip_builder_sessions").select("id").eq("user_id", userId);
  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);
  if (sessionIds.length > 0) {
    await safeDelete("trip_builder_stops", () => admin.from("trip_builder_stops").delete().in("session_id", sessionIds));
  }

  const { data: conversations } = await admin.from("support_conversations").select("id").eq("user_id", userId);
  const conversationIds = (conversations ?? []).map((c: { id: string }) => c.id);
  if (conversationIds.length > 0) {
    await safeDelete("support_messages", () => admin.from("support_messages").delete().in("conversation_id", conversationIds));
  }

  await safeDelete("tripmatch_sessions", () => admin.from("tripmatch_sessions").delete().eq("user_id", userId));
  await safeDelete("trip_builder_sessions", () => admin.from("trip_builder_sessions").delete().eq("user_id", userId));
  await safeDelete("trippy_ai_results", () => admin.from("trippy_ai_results").delete().eq("user_id", userId));
  await safeDelete("favorites", () => admin.from("favorites").delete().eq("user_id", userId));
  await safeDelete("travel_dna", () => admin.from("travel_dna").delete().eq("user_id", userId));
  await safeDelete("user_attribute_scores", () => admin.from("user_attribute_scores").delete().eq("user_id", userId));
  await safeDelete("destination_match_scores", () => admin.from("destination_match_scores").delete().eq("user_id", userId));
  await safeDelete("support_conversations", () => admin.from("support_conversations").delete().eq("user_id", userId));
  await safeDelete("token_transactions", () => admin.from("token_transactions").delete().eq("user_id", userId));
  await safeDelete("user_token_balances", () => admin.from("user_token_balances").delete().eq("user_id", userId));
  await safeDelete("notification_reads", () => admin.from("notification_reads").delete().eq("user_id", userId));
  // רק התראות *אישיות* של המשתמש הזה (user_id שווה) - לא נוגעים בהתראות
  // גלובליות (user_id is null) ששייכות לכל המשתמשים.
  await safeDelete("notifications (אישיות)", () => admin.from("notifications").delete().eq("user_id", userId));
  // referred_by מצביע *מ*-פרופילים אחרים *אל* המשתמש הזה - מנתקים כדי
  // ש-ON DELETE SET NULL (ר' migration 0061) לא יפתיע אף אחד, ומוחקים
  // גם את invite_code הייחודי שלו לפני שהשורה עצמה נמחקת.
  await safeDelete("profiles (referred_by של אחרים)", () => admin.from("profiles").update({ referred_by: null }).eq("referred_by", userId));
  await safeDelete("user_preferences", () => admin.from("user_preferences").delete().eq("id", userId));
  await safeDelete("profiles", () => admin.from("profiles").delete().eq("id", userId));

  return { warnings };
}
