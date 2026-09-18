import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { TRIP_TYPE_GROUPS, CUISINE_TAGS } from "@/services/places/tripTaxonomy";
import { isGenuinelyUnclassified, type ClassifiablePlaceRow } from "@/services/places/placeClassificationStatus";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

interface CandidatePlace extends ClassifiablePlaceRow {
  name: string;
  short_description: string | null;
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const mode: "untagged" | "all" | "needs_classification" = body?.mode === "all" ? "all" : body?.mode === "needs_classification" ? "needs_classification" : "untagged";
  const afterId: string | null = body?.afterId ?? null;

  const BATCH_SIZE = 15;
  const supabase = createAdminClient();

  let places: CandidatePlace[];
  let remaining: number;
  let lastId: string | null;

  if (mode === "needs_classification") {
    /**
     * *** תיקון (באג אמיתי - "כפתור סיווג להכל" עיבד רק trip_type_tags
     * ריק לגמרי, בזמן שהדשבורד/"הכל" משתמשים בהגדרה מדויקת יותר -
     * מקום עם subcategory ישן שלא תואם לאף סקשן אמיתי היה מדולג כאן
     * למרות שהוא "לא מסווג" בפועל. עכשיו אותה בדיקה בדיוק
     * (isGenuinelyUnclassified) קובעת גם מה מוצג ב"הכל", גם מה נספר
     * בדשבורד, וגם מה מעובד כאן - מקור אמת אחד, לא שלוש הגדרות שונות.
     */
    const { data: allRows, error: fetchError } = await supabase
      .from("places")
      .select("id,name,category,subcategory,short_description,trip_type_tags,tags,cuisine_tags")
      .eq("is_legacy", false)
      .eq("is_manually_edited", false)
      .order("id", { ascending: true });

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

    const unclassified = ((allRows ?? []) as CandidatePlace[]).filter((p) => isGenuinelyUnclassified(p));
    const startIndex = afterId ? unclassified.findIndex((p) => p.id > afterId) : 0;
    const pending = startIndex === -1 ? [] : unclassified.slice(startIndex);

    places = pending.slice(0, BATCH_SIZE);
    remaining = Math.max(0, pending.length - places.length);
    lastId = places.length > 0 ? places[places.length - 1].id : afterId;
  } else {
    let query = supabase
      .from("places")
      .select("id, name, category, subcategory, short_description, trip_type_tags, tags, cuisine_tags", { count: "exact" })
      .eq("is_manually_edited", false)
      .order("id", { ascending: true });

    if (mode === "untagged") {
      query = query.or("trip_type_tags.eq.{},trip_type_tags.is.null");
    } else if (afterId) {
      // "cursor" - ממשיכים מהמקום שנעצרנו, כדי לא לחזור על אותם מקומות שוב ושוב
      query = query.gt("id", afterId);
    }

    const { data, error, count } = await query.limit(BATCH_SIZE);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    places = (data ?? []) as CandidatePlace[];
    remaining = Math.max(0, (count ?? 0) - places.length);
    lastId = places.length > 0 ? places[places.length - 1].id : afterId;
  }

  const allTripTypeIds = TRIP_TYPE_GROUPS.map((g) => g.id).join(", ");
  const allSubTagIds = TRIP_TYPE_GROUPS.flatMap((g) => g.subTags.map((t) => t.id)).join(", ");
  const allCuisineIds = CUISINE_TAGS.map((t) => t.id).join(", ");

  let tagged = 0;
  let failed = 0;

  for (const place of places) {
    const prompt = `מקום: "${place.name}" (קטגוריה: ${place.category}, תת-קטגוריה: ${place.subcategory ?? "לא ידוע"})
תיאור: ${place.short_description ?? "אין תיאור"}

בחר תיוג מדויק מתוך הרשימות הבאות בלבד:
trip_type_tags אפשריים: ${allTripTypeIds}
תתי-תגיות אפשריים: ${allSubTagIds}
cuisine_tags אפשריים (רק אם רלוונטי): ${allCuisineIds}

*** חשוב מאוד: תייג בצמצום ובדיוק, לא בנדיבות!
- trip_type_tags: בחר לכל היותר 1-2 (רק אם המקום *באמת* משרת שתי מטרות עיקריות, אחרת 1 בלבד). אל תוסיף קטגוריה רק כי יש קשר רופף.
- sub_tags: עד 3, רק הכי מדויקים.
- עדיף תיוג חד ומצומצם על פני תיוג רחב ומטושטש. ***

השב אך ורק JSON: {"trip_type_tags": ["..."], "sub_tags": ["..."], "cuisine_tags": ["..."], "kosher": true/false/null, "accessible": true/false/null, "seasons": ["..."], "suitable_child_ages": ["..."], "budget_tier": "$/$$/$$$/$$$$" or null}`;

    const { text } = await callClaude(prompt);
    if (!text) {
      failed++;
      continue;
    }

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("no json");
      const s = JSON.parse(jsonMatch[0]);

      await supabase
        .from("places")
        .update({
          trip_type_tags: Array.from(new Set([...(s.trip_type_tags ?? []), ...(s.sub_tags ?? [])])),
          cuisine_tags: s.cuisine_tags ?? [],
          kosher: s.kosher ?? null,
          accessible: s.accessible ?? null,
          seasons: s.seasons ?? [],
          suitable_child_ages: s.suitable_child_ages ?? [],
          budget_tier: s.budget_tier ?? null,
        })
        .eq("id", place.id);

      tagged++;
    } catch (parseError) {
      logAiError("כשל בתיוג בכמות", {
        placeId: place.id,
        message: parseError instanceof Error ? parseError.message : String(parseError),
      });
      failed++;
    }
  }

  return NextResponse.json({
    processedNow: places.length,
    tagged,
    failed,
    remaining,
    lastId,
  });
}