import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_locations")
    .update({
      name_he: body.name_he,
      name_en: body.name_en ?? null,
      country_code: body.country_code ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ location: data });
}

/** מחיקה נכשלת אוטומטית אם יש ילדים (foreign key) - זו הגנה מכוונת נגד
 *  מחיקת מדינה/עיר שיש לה ערים/אזורים מתחתיה בטעות. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createAdminClient();

  const { count } = await supabase
    .from("admin_locations")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id);
  if (count && count > 0) {
    return NextResponse.json({ error: `לא ניתן למחוק - יש ${count} מיקומים תלויים תחתיו` }, { status: 400 });
  }

  const { error } = await supabase.from("admin_locations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
