import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { rowToDiscoveryPlace, type PlaceRow } from "@/services/places/discoveryService";
import { ADMIN_DISCOVERY_SECTIONS, type AdminDiscoverySection } from "@/constants/adminDiscoverySections";
import { QUICK_CATEGORY_FALLBACK_MAIN_CATEGORIES } from "@/constants/placeCategories";
import { matchesSection } from "@/services/places/placeClassificationStatus";
import type { QuickCategoryId } from "@/constants/quickCategories";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

interface FullPlaceRow extends PlaceRow {
  trip_type_tags: string[] | null;
  cuisine_tags: string[] | null;
  country: string | null;
}

/** האם המקום הזה מסווג לאיזשהו סקשן בתוך רשימת הסקשנים של סוג הטיול
 *  הנוכחי (בדיוק אותה בדיקה כמו characterization-stats, מקור אמת יחיד -
 *  ר' services/places/placeClassificationStatus.ts). */
function matchesAnySection(p: FullPlaceRow, sections: AdminDiscoverySection[]): boolean {
  return sections.some((section) => matchesSection(p, section));
}

/**
 * "הכל" - עמוד הבית של סוג טיול, *לפני* בחירת סקשן ספציפי (דרישה
 * מפורשת #4/#5/#6: "Place לא נעלם רק כי עדיין לא סיווגנו אותו"). מציג
 * כל מקום עם category רלוונטי לסוג הטיול (ר' QUICK_CATEGORY_FALLBACK_
 * MAIN_CATEGORIES) - גם אם אין לו שום סיווג משני - עם needsClassification
 * לכל מקום, כדי שה-UI יוכל להבדיל "מסווג" מ"דורש סיווג".
 */
export async function GET(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const quickCategory = searchParams.get("quickCategory") as QuickCategoryId | null;
  const country = searchParams.get("country") || undefined;
  const limit = Number(searchParams.get("limit") ?? 500);

  if (!quickCategory) return NextResponse.json({ error: "יש לספק quickCategory" }, { status: 400 });

  const fallbackCategories = QUICK_CATEGORY_FALLBACK_MAIN_CATEGORIES[quickCategory];
  const sections = ADMIN_DISCOVERY_SECTIONS[quickCategory];
  if (!fallbackCategories || !sections) {
    return NextResponse.json({ error: "סוג הטיול הזה לא משתמש במנגנון 'הכל' (abroad/weekend יש להם מנגנון נפרד)" }, { status: 400 });
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("places")
    .select("id,name,category,subcategory,short_description,image_urls,rating,rating_count,city,latitude,longitude,tags,opening_hours,trip_type_tags,cuisine_tags,country")
    .eq("is_legacy", false)
    .in("category", fallbackCategories)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (country) query = query.eq("country", country);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as FullPlaceRow[];
  const places = rows.map((row) => ({
    ...rowToDiscoveryPlace(row, null),
    tripTypeTags: row.trip_type_tags ?? [],
    cuisineTags: row.cuisine_tags ?? [],
    needsClassification: !matchesAnySection(row, sections),
  }));

  const needsClassificationCount = places.filter((p) => p.needsClassification).length;

  return NextResponse.json({
    places,
    counts: { total: places.length, classified: places.length - needsClassificationCount, needsClassification: needsClassificationCount },
  });
}
