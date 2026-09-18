import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

export interface AdminLocation {
  id: string;
  level: "country" | "city" | "area";
  parent_id: string | null;
  name_he: string;
  name_en: string | null;
  country_code: string | null;
  created_at: string;
  updated_at: string;
}

/** מחזירה מיקומים - ?parent_id=X לילדים של מיקום מסוים, ?level=country
 *  לכל המדינות (שורש ההיררכיה), בלי פרמטרים = הכל. */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("parent_id");
  const level = searchParams.get("level");

  const supabase = createAdminClient();
  let query = supabase.from("admin_locations").select("*").order("name_he", { ascending: true });

  if (parentId) query = query.eq("parent_id", parentId);
  if (level) query = query.eq("level", level);
  if (parentId === "null") query = query.is("parent_id", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ locations: (data ?? []) as AdminLocation[] });
}

/** יוצרת מיקום חדש (מדינה/עיר/אזור). מדינה - parent_id חייב להיות null.
 *  עיר/אזור - parent_id חובה (מצביע למדינה/עיר ההורה). */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.level || !body?.name_he) {
    return NextResponse.json({ error: "יש לספק level ו-name_he" }, { status: 400 });
  }
  if (body.level !== "country" && !body.parent_id) {
    return NextResponse.json({ error: "עיר/אזור חייבים parent_id" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_locations")
    .insert({
      level: body.level,
      parent_id: body.level === "country" ? null : body.parent_id,
      name_he: body.name_he,
      name_en: body.name_en ?? null,
      country_code: body.country_code ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ location: data as AdminLocation });
}
