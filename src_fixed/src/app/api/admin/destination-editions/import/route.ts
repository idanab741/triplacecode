import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/**
 * מייבאת יעדים קיימים מטבלת destinations (הישנה, שכבר מלאה בתוכן -
 * ראה "למה זה ריק?" ב-Admin Places) לתוך destination_editions, במקום
 * להקליד ידנית מחדש כל יעד שכבר קיים באפליקציה.
 *
 * לכל destinationId שנבחר:
 * 1. יוצרת מהדורה (destination_edition) תחת quickCategory שנבחר -
 *    title=שם היעד, image=image_url הקיים, description=description
 *    הקיים. מדלגת אם כבר קיימת מהדורה לאותו destination_id+quick_category
 *    (לא יוצרת כפילות אם מריצים ייבוא פעמיים).
 * 2. מייבאת אוטומטית *את כל האטרקציות שכבר קיימות* ב-places עם city
 *    תואם (ilike) לשם היעד - כך שהאטרקציות שכבר תויגו ע"י צוות התוכן
 *    מופיעות מיד, בלי לשייך כל אחת ידנית.
 */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const quickCategory: string | undefined = body?.quickCategory;
  const destinationIds: string[] | undefined = Array.isArray(body?.destinationIds) ? body.destinationIds : undefined;

  if (!quickCategory || !destinationIds || destinationIds.length === 0) {
    return NextResponse.json({ error: "יש לספק quickCategory ו-destinationIds" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: destinations, error: destError } = await supabase
    .from("destinations")
    .select("id, name, country, image_url, image_urls, description, short_description")
    .in("id", destinationIds);
  if (destError) return NextResponse.json({ error: destError.message }, { status: 500 });

  // *** יעדים שכבר יובאו תחת הקטגוריה הזו - נדלג עליהם, כדי שהרצה
  // חוזרת של הייבוא (למשל אחרי שנוספו יעדים חדשים ב-destinations) לא
  // תיצור מהדורה כפולה לאותו יעד+קטגוריה.
  const { data: existingEditions } = await supabase
    .from("destination_editions")
    .select("destination_id")
    .eq("quick_category", quickCategory)
    .in("destination_id", destinationIds);
  const alreadyImported = new Set((existingEditions ?? []).map((e) => e.destination_id));

  const results: { destinationName: string; created: boolean; linkedPlaces: number }[] = [];
  const errors: string[] = [];

  for (const destination of destinations ?? []) {
    if (alreadyImported.has(destination.id)) {
      results.push({ destinationName: destination.name, created: false, linkedPlaces: 0 });
      continue;
    }

    const imageUrl = destination.image_url ?? (destination.image_urls?.[0] as string | undefined) ?? null;
    const description = destination.description ?? destination.short_description ?? null;

    const { data: edition, error: editionError } = await supabase
      .from("destination_editions")
      .insert({
        destination_id: destination.id,
        quick_category: quickCategory,
        title: destination.name,
        image_url: imageUrl,
        description,
      })
      .select("id")
      .single();

    if (editionError || !edition) {
      errors.push(`"${destination.name}" - ${editionError?.message ?? "שגיאה ביצירת המהדורה"}`);
      continue;
    }

    // התאמת אטרקציות קיימות לפי עיר (ilike, כדי לתפוס "ניו יורק" /
    // "ניו-יורק" וכו') - best-effort, לא מדויק ל-100% אבל חוסך את רוב
    // השיוך הידני. אפשר תמיד להוסיף/להסיר ידנית אחרי הייבוא.
    const { data: matchingPlaces } = await supabase
      .from("places")
      .select("id")
      .ilike("city", `%${destination.name}%`)
      .eq("is_legacy", false)
      .limit(200);

    let linkedPlaces = 0;
    if (matchingPlaces && matchingPlaces.length > 0) {
      const { error: linkError } = await supabase.from("destination_edition_places").upsert(
        matchingPlaces.map((p) => ({ edition_id: edition.id, place_id: p.id })),
        { onConflict: "edition_id,place_id", ignoreDuplicates: true }
      );
      if (!linkError) linkedPlaces = matchingPlaces.length;
    }

    results.push({ destinationName: destination.name, created: true, linkedPlaces });
  }

  return NextResponse.json({ results, errors });
}
