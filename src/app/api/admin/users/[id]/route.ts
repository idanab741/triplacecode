import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { deleteUserCompletely } from "@/services/admin/userDeletion";
import { getUserFullDetail } from "@/services/admin/userDetailService";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** User 360° - ר' services/admin/userDetailService.ts לכל הלוגיקה
 *  (משותפת עם /export כדי לא לשכפל את השאילתה הענקית). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: userId } = await params;

  const supabase = createAdminClient();
  const detail = await getUserFullDetail(supabase, userId);
  if (!detail) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  return NextResponse.json(detail);
}

/** מחיקה מלאה (Danger Zone) - הניקוי חי ב-services/admin/userDeletion.ts,
 *  משותף עם /api/profile/delete-account (מחיקה עצמית). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: userId } = await params;

  const supabase = createAdminClient();
  const { warnings } = await deleteUserCompletely(supabase, userId);

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    const detail = warnings.length > 0 ? ` (שלבים קודמים שנכשלו: ${warnings.join(" | ")})` : "";
    return NextResponse.json({ error: `${error.message}${detail}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, warnings: warnings.length > 0 ? warnings : undefined });
}

/** Suspend/Restore - דרך מנגנון ה-ban המובנה של Supabase Auth Admin API
 *  (תשתית קיימת אמיתית, לא מומצאת - ban_duration הוא שדה רשמי של
 *  updateUserById). PATCH עם {action:"restore"} מבטל ban. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: userId } = await params;

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "suspend" && action !== "restore") {
    return NextResponse.json({ error: "פעולה לא תקינה" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: action === "suspend" ? "876000h" : "none", // ~100 שנה = "בפועל לצמיתות", הפיך תמיד דרך restore
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, isBanned: action === "suspend" });
}
