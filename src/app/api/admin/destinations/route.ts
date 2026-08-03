import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** מוסיפה יעד חדש (בסיסי - שאר השדות מתמלאים בעריכה). */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name: string | undefined = body?.name;
  const country: string | undefined = body?.country;

  if (!name || !country) {
    return NextResponse.json({ error: "יש לספק name ו-country" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("destinations")
    .insert({ name, country, status: "draft" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ destination: data });
}

/** מחזירה את כל היעדים, לתצוגה בעמוד האדמין. */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .order("created_at", { ascending: false })
    .range(0, 4999);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ destinations: data });
}
