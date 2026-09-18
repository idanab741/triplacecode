import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";
import { deleteUserCompletely } from "@/services/admin/userDeletion";

/** מוחקת חשבון משתמש לגמרי - הניקוי המלא (כל הטבלאות) חי במקום אחד
 *  משותף (services/admin/userDeletion.ts), כדי שגם מחיקה עצמית (כאן)
 *  וגם מחיקה ע"י Admin ינקו תמיד בדיוק אותן טבלאות. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[delete-account] createAdminClient failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { warnings: stepErrors } = await deleteUserCompletely(admin, user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    // מדפיסים את השגיאה המלאה ליומן השרת (טרמינל של npm run dev /
    // Vercel Function Logs) - כי error.message לפעמים ריק/לא-אינפורמטיבי,
    // וצריך לראות את כל האובייקט כדי להבין מה קרה בפועל.
    const fullDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
    console.error("[delete-account] admin.auth.admin.deleteUser failed:", fullDetails);
    const detail = stepErrors.length > 0 ? ` (שלבים קודמים שנכשלו: ${stepErrors.join(" | ")})` : "";
    // JSON.stringify(error) רגיל תמיד נותן "{}" כי message/stack הן
    // non-enumerable על אובייקט Error - לכן משתמשים כאן ב-fullDetails.
    const message = error.message || fullDetails;
    return NextResponse.json({ error: `${message}${detail}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, warnings: stepErrors.length > 0 ? stepErrors : undefined });
}
