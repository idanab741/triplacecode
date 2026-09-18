import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** רשימת כל מהדורות היעד (destination_editions), עם שם/מדינה של היעד
 *  הבסיסי (join) וספירת אטרקציות משויכות - בשביל הגריד בעמוד Admin
 *  Places (/admin/place-console) ותצוגת "כמה אטרקציות יש כבר ליעד הזה"
 *  בלי לפתוח כל כרטיס בנפרד. אפשר לסנן לפי quickCategory (סוג הטיול
 *  שנבחר בסרגל העליון). */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const quickCategory = searchParams.get("quickCategory");

  const supabase = createAdminClient();
  let query = supabase
    .from("destination_editions")
    .select("*, destinations(id, name, country), destination_edition_places(count)")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (quickCategory) query = query.eq("quick_category", quickCategory);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const editions = (data ?? []).map((row: Record<string, unknown>) => {
    const { destination_edition_places, ...rest } = row;
    const counts = destination_edition_places as { count: number }[] | undefined;
    return { ...rest, placesCount: counts?.[0]?.count ?? 0 };
  });

  return NextResponse.json({ editions });
}

/** יוצרת מהדורת יעד חדשה. body.destinationId - עיר בסיס קיימת (מ-
 *  destinations). אם אין destinationId אבל יש destinationName+country,
 *  יוצרים קודם שורת destinations בסיסית (בדיוק כמו POST הקיים
 *  ב-/api/admin/destinations) ואז את המהדורה שמצביעה עליה - כדי
 *  שהאדמין לא יצטרך לצאת לעמוד אחר כדי להתחיל יעד חדש מאפס. */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const quickCategory: string | undefined = body?.quickCategory;
  const subtitle: string | undefined = body?.subtitle;
  const groupLabel: string | undefined = body?.groupLabel;
  let destinationId: string | undefined = body?.destinationId;
  const destinationName: string | undefined = body?.destinationName;
  const country: string | undefined = body?.country;

  if (!quickCategory) {
    return NextResponse.json({ error: "יש לספק quickCategory" }, { status: 400 });
  }
  if (!destinationId && (!destinationName || !country)) {
    return NextResponse.json(
      { error: "יש לספק destinationId קיים, או destinationName+country ליצירת יעד חדש" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  let title = body?.title as string | undefined;

  if (!destinationId) {
    const { data: newDestination, error: destError } = await supabase
      .from("destinations")
      .insert({ name: destinationName, country, status: "draft" })
      .select("id, name")
      .single();
    if (destError) return NextResponse.json({ error: destError.message }, { status: 500 });
    destinationId = newDestination.id;
    title = title ?? newDestination.name;
  }

  if (!title) {
    const { data: existingDestination } = await supabase
      .from("destinations")
      .select("name")
      .eq("id", destinationId)
      .single();
    title = existingDestination?.name ?? "יעד חדש";
  }

  const { data, error } = await supabase
    .from("destination_editions")
    .insert({ destination_id: destinationId, quick_category: quickCategory, title, subtitle: subtitle ?? null, group_label: groupLabel ?? null })
    .select("*, destinations(id, name, country)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ edition: data });
}
