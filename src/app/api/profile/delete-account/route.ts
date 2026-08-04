import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";

/** מוחקת חשבון משתמש לגמרי. מנקה במפורש כל טבלה שמצאתי בקוד שמצביעה על
 *  user_id/id של המשתמש - כי Postgres מסרב למחוק את auth.users כל עוד
 *  יש שורות שמצביעות אליו (Foreign Key), אלא אם יש ON DELETE CASCADE.
 *  כל מחיקה עטופה בנפרד כדי שטבלה אחת שנכשלת (או לא קיימת) לא תעצור
 *  את כל התהליך - וכל שגיאה נאספת ומוחזרת בבירור בסוף. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const admin = createAdminClient();
  const userId = user.id;
  const stepErrors: string[] = [];

  async function safeDelete(label: string, run: () => Promise<{ error: { message: string } | null }>) {
    try {
      const { error } = await run();
      if (error) stepErrors.push(`${label}: ${error.message}`);
    } catch (e) {
      stepErrors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // stops לפני sessions (תלות ישירה), אחר כך כל השאר - סדר לא קריטי
  // ביניהם כי כולן תלויות ב-userId ישירות, לא זו בזו.
  const { data: sessions } = await admin.from("trip_builder_sessions").select("id").eq("user_id", userId);
  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length > 0) {
    await safeDelete("trip_builder_stops", () => admin.from("trip_builder_stops").delete().in("session_id", sessionIds));
  }
  await safeDelete("trip_builder_sessions", () => admin.from("trip_builder_sessions").delete().eq("user_id", userId));
  await safeDelete("favorites", () => admin.from("favorites").delete().eq("user_id", userId));
  await safeDelete("travel_dna", () => admin.from("travel_dna").delete().eq("user_id", userId));
  await safeDelete("user_attribute_scores", () => admin.from("user_attribute_scores").delete().eq("user_id", userId));
  await safeDelete("destination_match_scores", () => admin.from("destination_match_scores").delete().eq("user_id", userId));
  await safeDelete("user_preferences", () => admin.from("user_preferences").delete().eq("id", userId));
  await safeDelete("profiles", () => admin.from("profiles").delete().eq("id", userId));

  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    const detail = stepErrors.length > 0 ? ` (שלבים קודמים שנכשלו: ${stepErrors.join(" | ")})` : "";
    return NextResponse.json({ error: `${error.message}${detail}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, warnings: stepErrors.length > 0 ? stepErrors : undefined });
}
