import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";

/** מוחקת חשבון משתמש לגמרי. הסיבה הכי סבירה לכישלון (500) היא הפרת
 *  Foreign Key: יש שורות ב-profiles / user_preferences /
 *  trip_builder_sessions (וכו') שמצביעות על ה-user_id הזה, ו-Postgres
 *  מסרב למחוק את auth.users כל עוד הן קיימות (אלא אם יש ON DELETE
 *  CASCADE - שלא בטוח שמוגדר). לכן מוחקים קודם באופן מפורש את כל
 *  הטבלאות התלויות, ורק אז את המשתמש עצמו. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const admin = createAdminClient();
  const userId = user.id;

  // מוחקים קודם את כל הנתונים התלויים - בסדר שלא ישבור עוד FK-ים
  // (stops לפני sessions, ליתר ביטחון, גם אם כבר יש CASCADE ביניהם).
  const { data: sessions } = await admin.from("trip_builder_sessions").select("id").eq("user_id", userId);
  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length > 0) {
    await admin.from("trip_builder_stops").delete().in("session_id", sessionIds);
  }
  await admin.from("trip_builder_sessions").delete().eq("user_id", userId);
  await admin.from("user_preferences").delete().eq("id", userId);
  await admin.from("profiles").delete().eq("id", userId);

  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
