import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** מהדורת יעד בודדת, כולל כל האטרקציות המשויכות (שורות places מלאות,
 *  לא רק id) - זה מה שממלא את ה-preview (צד שמאל) ואת רשימת "אטרקציות"
 *  בפאנל העריכה (צד ימין) בעמוד /admin/place-console/[id]. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: edition, error } = await supabase
    .from("destination_editions")
    .select("*, destinations(id, name, country)")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!edition) return NextResponse.json({ error: "מהדורת היעד לא נמצאה" }, { status: 404 });

  const { data: links, error: linksError } = await supabase
    .from("destination_edition_places")
    .select("place_id, sort_order, places(*)")
    .eq("edition_id", id)
    .order("sort_order", { ascending: true });

  if (linksError) return NextResponse.json({ error: linksError.message }, { status: 500 });

  const places = (links ?? []).map((l) => l.places).filter(Boolean);

  return NextResponse.json({ edition, places });
}

/** עריכת שדות המהדורה (תמונה, כותרת, תת-כותרת, תיאור, מזג אוויר וכו'). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });

  const ALLOWED_FIELDS = [
    "title",
    "subtitle",
    "image_url",
    "description",
    "weather_notes",
    "quick_category",
    "group_label",
    "sort_order",
    "is_published",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) patch[field] = body[field];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "לא נשלח אף שדה לעדכון" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("destination_editions")
    .update(patch)
    .eq("id", id)
    .select("*, destinations(id, name, country)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ edition: data });
}

/** מוחקת את המהדורה עצמה (לא את היעד הבסיסי, ולא את האטרקציות
 *  המשויכות - destination_edition_places נמחקות אוטומטית ע"י cascade,
 *  אבל השורות ב-places עצמן נשארות שלמות, כמו שסוכם). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("destination_editions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
