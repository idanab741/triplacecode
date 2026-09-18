import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** רשימת מדינות ייחודיות שקיימות בפועל ב-places - לפילטר "מדינה" בעמוד
 *  Admin Places (לא רשימה קבועה - נגזרת מהדאטה עצמה, אז תמיד מדויקת
 *  למה שבאמת קיים במאגר). */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("places")
    .select("country")
    .eq("is_legacy", false)
    .not("country", "is", null)
    .range(0, 4999);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const countries = Array.from(new Set((data ?? []).map((r) => r.country as string).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "he")
  );

  return NextResponse.json({ countries });
}
