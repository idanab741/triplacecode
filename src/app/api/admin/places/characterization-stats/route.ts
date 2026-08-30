import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { TRIP_TYPE_GROUPS } from "@/services/places/tripTaxonomy";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/**
 * דשבורד "כמה אטרקציות לא מאופיינות" (דרישה מפורשת).
 *
 * *** תיקון (באג אמיתי - "אין סיכוי ש-90% לא מאופיין!!"): הגרסה
 * הקודמת הגדירה "לא מאופיין" כ-trip_type_tags ריק *בלבד*. אבל בדקתי
 * את מנוע ההתאמה האמיתי (buildCategoryOrFilter ב-discoveryService.ts)
 * ומצאתי שהוא כבר בודק trip_type_tags **או** subcategory (OR, לא AND) -
 * מקום עם subcategory="nature_reserve" למשל כבר מוצג נכון בסקשן
 * "שמורות טבע" גם בלי שום ערך ב-trip_type_tags. כנ"ל למסעדות/חיי לילה,
 * שמתויגים דרך cuisine_tags/tags (ר' handleEnrichFromGoogle ב-admin/
 * places/[id]) - שדות נפרדים לגמרי מ-trip_type_tags. הדשבורד הקודם
 * התעלם מכל זה וספר מקומות "לא מאופיינים" גם כשהם למעשה כן מוצגים
 * נכון באפליקציה - בדיוק למה 89% הרגיש מנופח/שגוי. "מאופיין" עכשיו
 * אומר: יש ערך באחד לפחות מ-4 השדות שהמנוע האמיתי בודק (לא רק אחד מהם).
 */
export async function GET(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: places, error } = await supabase
    .from("places")
    .select("id,category,subcategory,trip_type_tags,tags,cuisine_tags,city,is_legacy")
    .eq("is_legacy", false)
    .range(0, 9999); // בלי range מפורש, PostgREST חותך ב-1000 שורות בשקט - ר' /api/admin/places/route.ts לאותו דפוס

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (places ?? []) as {
    id: string;
    category: string | null;
    subcategory: string | null;
    trip_type_tags: string[] | null;
    tags: string[] | null;
    cuisine_tags: string[] | null;
    city: string | null;
  }[];

  const total = rows.length;

  function isCharacterized(p: (typeof rows)[number]): boolean {
    return Boolean(
      (p.trip_type_tags && p.trip_type_tags.length > 0) ||
        p.subcategory ||
        (p.tags && p.tags.length > 0) ||
        (p.cuisine_tags && p.cuisine_tags.length > 0)
    );
  }

  const uncharacterized = rows.filter((p) => !isCharacterized(p));
  const onlyViaTripTypeTags = rows.filter((p) => p.trip_type_tags && p.trip_type_tags.length > 0);
  const onlyViaSubcategory = rows.filter((p) => !p.trip_type_tags?.length && p.subcategory);
  const onlyViaTagsOrCuisine = rows.filter(
    (p) => !p.trip_type_tags?.length && !p.subcategory && ((p.tags && p.tags.length > 0) || (p.cuisine_tags && p.cuisine_tags.length > 0))
  );
  const noCity = rows.filter((p) => !p.city);

  // "לפי סוג טיול" - כאן עדיין רק trip_type_tags (זה השדה שקובע שיוך
  // ל*יעד*/*סוג מסלול עצמו* בעמוד "סוגי מסלול", לא רק "יש תיוג כלשהו") -
  // נשאר כפי שהיה, כי זה מודד משהו שונה מ"מאופיין בכלל".
  const perGroup = TRIP_TYPE_GROUPS.map((g) => ({
    id: g.id,
    emoji: g.emoji,
    label: g.label,
    count: rows.filter((p) => (p.trip_type_tags ?? []).includes(g.id)).length,
  })).sort((a, b) => a.count - b.count);

  return NextResponse.json({
    total,
    uncharacterized: { count: uncharacterized.length, pct: total > 0 ? Math.round((uncharacterized.length / total) * 1000) / 10 : 0, sampleIds: uncharacterized.slice(0, 20).map((p) => p.id) },
    breakdown: {
      viaTripTypeTags: onlyViaTripTypeTags.length,
      viaSubcategoryOnly: onlyViaSubcategory.length,
      viaTagsOrCuisineOnly: onlyViaTagsOrCuisine.length,
    },
    noCity: { count: noCity.length },
    perGroup,
  });
}

