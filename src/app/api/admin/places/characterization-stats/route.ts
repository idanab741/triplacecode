import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { TRIP_TYPE_GROUPS } from "@/services/places/tripTaxonomy";
import { ADMIN_DISCOVERY_SECTIONS, type AdminDiscoverySection } from "@/constants/adminDiscoverySections";
import { QUICK_CATEGORIES } from "@/constants/quickCategories";
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

interface PlaceRow {
  id: string;
  category: string | null;
  subcategory: string | null;
  trip_type_tags: string[] | null;
  tags: string[] | null;
  cuisine_tags: string[] | null;
  city: string | null;
}

/** אותה לוגיקה בדיוק כמו buildCategoryOrFilter/queryPlaces
 *  (discoveryService.ts) - לא מחזור-מקורב, בדיקה זהה שורה-שורה, כדי
 *  שהמספרים כאן יהיו בדיוק מה שהמשתמש רואה בפועל בעמוד "סוגי מסלול". */
function placeMatchesSection(p: PlaceRow, section: AdminDiscoverySection): boolean {
  if (section.categoryColumnEquals) {
    const columnMatch = p.category === section.categoryColumnEquals;
    if (section.requiredAnyTags?.length) return columnMatch || section.requiredAnyTags.some((t) => (p.tags ?? []).includes(t));
    return columnMatch;
  }
  const groupIds = section.categories ?? (section.category ? [section.category] : []);
  if (groupIds.length > 0 || section.subcategories?.length) {
    const groupMatch = groupIds.some((c) => (p.trip_type_tags ?? []).includes(c));
    const subcatMatch = !!section.subcategories?.length && !!p.subcategory && section.subcategories.includes(p.subcategory);
    if (!groupMatch && !subcatMatch) return false;
  }
  if (section.requiredAnyTags?.length && !section.requiredAnyTags.some((t) => (p.tags ?? []).includes(t))) return false;
  if (section.requiredAnyCuisineTags?.length && !section.requiredAnyCuisineTags.some((t) => (p.cuisine_tags ?? []).includes(t))) return false;
  return true;
}

/**
 * דשבורד "כמה אטרקציות לא מאופיינות" (דרישה מפורשת).
 *
 * *** תיקון שני (באג אמיתי - "למה טיול בטבע עדיין ריק????"): הגרסה
 * הקודמת בדקה רק "האם יש איזשהו ערך" ב-4 השדות (trip_type_tags/
 * subcategory/tags/cuisine_tags) - זה נתן אחוז אפיון גבוה יותר, אבל לא
 * ענה על השאלה האמיתית: "יערות וחורשות" (nature_trip) דורש בדיוק
 * subcategory ב-["forest","grove"] או trip_type_tags עם "nature_trails" -
 * מקום עם subcategory="hiking_trail" למשל *כן* "מאופיין" (יש לו ערך),
 * אבל עדיין *לא* יתאים לסקשן הספציפי הזה. עכשיו יש bySection - ספירה
 * אמיתית, סקשן-סקשן, בדיוק לפי אותה לוגיקה שקובעת מה מוצג בעמוד -
 * מראה בדיוק אילו סקשנים ספציפיים ריקים/דלים, לא רק אחוז כללי.
 */
export async function GET(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: places, error } = await supabase
    .from("places")
    .select("id,category,subcategory,trip_type_tags,tags,cuisine_tags,city,is_legacy")
    .eq("is_legacy", false)
    .range(0, 9999);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (places ?? []) as PlaceRow[];
  const total = rows.length;

  function isCharacterized(p: PlaceRow): boolean {
    return Boolean((p.trip_type_tags && p.trip_type_tags.length > 0) || p.subcategory || (p.tags && p.tags.length > 0) || (p.cuisine_tags && p.cuisine_tags.length > 0));
  }
  const uncharacterized = rows.filter((p) => !isCharacterized(p));
  const onlyViaTripTypeTags = rows.filter((p) => p.trip_type_tags && p.trip_type_tags.length > 0);
  const onlyViaSubcategory = rows.filter((p) => !p.trip_type_tags?.length && p.subcategory);
  const onlyViaTagsOrCuisine = rows.filter(
    (p) => !p.trip_type_tags?.length && !p.subcategory && ((p.tags && p.tags.length > 0) || (p.cuisine_tags && p.cuisine_tags.length > 0))
  );

  const perGroup = TRIP_TYPE_GROUPS.map((g) => ({
    id: g.id,
    emoji: g.emoji,
    label: g.label,
    count: rows.filter((p) => (p.trip_type_tags ?? []).includes(g.id)).length,
  })).sort((a, b) => a.count - b.count);

  // *** החלק החדש: ספירה אמיתית סקשן-סקשן, על כל 6 סוגי הטיול שמבוססים
  // על ADMIN_DISCOVERY_SECTIONS (לא abroad/weekend - יש להם מנגנון נפרד
  // לגמרי, destination_editions/רדיוס geo, לא שייך לדשבורד הזה).
  const bySection: { quickCategory: string; quickCategoryLabel: string; sectionId: string; emoji: string; title: string; count: number }[] = [];
  for (const cat of QUICK_CATEGORIES) {
    if (cat.id === "abroad") continue; // מנגנון נפרד (destination_editions) - לא שייך לכאן
    const sections = ADMIN_DISCOVERY_SECTIONS[cat.id];
    if (!sections) continue;
    for (const section of sections) {
      bySection.push({
        quickCategory: cat.id,
        quickCategoryLabel: QUICK_CATEGORY_LABELS[cat.id],
        sectionId: section.id,
        emoji: section.emoji,
        title: section.title,
        count: rows.filter((p) => placeMatchesSection(p, section)).length,
      });
    }
  }
  bySection.sort((a, b) => a.count - b.count);
  const emptySections = bySection.filter((s) => s.count === 0);

  return NextResponse.json({
    total,
    uncharacterized: { count: uncharacterized.length, pct: total > 0 ? Math.round((uncharacterized.length / total) * 1000) / 10 : 0, sampleIds: uncharacterized.slice(0, 20).map((p) => p.id) },
    breakdown: {
      viaTripTypeTags: onlyViaTripTypeTags.length,
      viaSubcategoryOnly: onlyViaSubcategory.length,
      viaTagsOrCuisineOnly: onlyViaTagsOrCuisine.length,
    },
    perGroup,
    bySection,
    emptySectionsCount: emptySections.length,
    totalSectionsCount: bySection.length,
  });
}


