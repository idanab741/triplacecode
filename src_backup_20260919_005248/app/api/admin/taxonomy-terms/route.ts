import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

export interface TaxonomyTerm {
  id: string;
  taxonomy_group: string;
  parent_term_id: string | null;
  value: string;
  label_he: string;
  emoji: string | null;
  image_src: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** מחזירה את כל מונחי הטקסונומיה. אופציונלי: ?taxonomy_group=trip_type לסינון. */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const group = new URL(request.url).searchParams.get("taxonomy_group");
  const supabase = createAdminClient();

  let query = supabase
    .from("taxonomy_terms")
    .select("*")
    .order("taxonomy_group", { ascending: true })
    .order("sort_order", { ascending: true });

  if (group) query = query.eq("taxonomy_group", group);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ terms: data });
}

/** יוצרת מונח חדש - בקבוצת טקסונומיה קיימת, או בקבוצה חדשה לגמרי (פשוט ע"י
 *  שימוש ב-taxonomy_group שעוד לא קיים). parent_term_id אופציונלי - למשל
 *  תת-קטגוריית עניין תחת קטגוריית עניין ראשית. */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { taxonomy_group, parent_term_id, value, label_he, emoji, image_src, sort_order } = body ?? {};

  if (!taxonomy_group || !value || !label_he) {
    return NextResponse.json({ error: "יש לספק taxonomy_group, value, label_he" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("taxonomy_terms")
    .insert({
      taxonomy_group,
      parent_term_id: parent_term_id ?? null,
      value,
      label_he,
      emoji: emoji ?? null,
      image_src: image_src ?? null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    const message = error.code === "23505" ? `כבר קיים מונח בשם "${value}" בקבוצה "${taxonomy_group}"` : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ term: data });
}
