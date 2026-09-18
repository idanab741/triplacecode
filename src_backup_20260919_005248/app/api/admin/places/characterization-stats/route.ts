import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { TRIP_TYPE_GROUPS } from "@/services/places/tripTaxonomy";
import { ADMIN_DISCOVERY_SECTIONS } from "@/constants/adminDiscoverySections";
import { QUICK_CATEGORIES } from "@/constants/quickCategories";
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";
import { isGenuinelyUnclassified, matchesSection, type ClassifiablePlaceRow } from "@/services/places/placeClassificationStatus";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

interface PlaceRow extends ClassifiablePlaceRow {
  city: string | null;
}

/**
 * דשבורד "כמה אטרקציות לא מאופיינות" (דרישה מפורשת).
 *
 * *** תיקון שלישי (באג אמיתי - "0%?? אין סיכוי!!"): הגרסה הקודמת בדקה
 * "יש ערך באיזשהו שדה" - זה נתן 0% כי כמעט לכל מקום יש *משהו* באיזה
 * שדה (גם אם זה subcategory ישן/שרירותי שלא תואם לאף סקשן אמיתי).
 * "מאופיין" עכשיו אומר בדיוק מה שקובע אם המקום מופיע בפועל בעמוד:
 * isGenuinelyUnclassified (services/places/placeClassificationStatus.ts) -
 * אותה בדיקה בדיוק שקובעת needsClassification בתצוגת "הכל", מקור
 * אמת אחד ויחיד לשלושתם (דשבורד / "הכל" / כפתור הסיווג האוטומטי).
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

  const uncharacterized = rows.filter((p) => isGenuinelyUnclassified(p));
  const classified = rows.filter((p) => !isGenuinelyUnclassified(p));
  const viaTripTypeTags = classified.filter((p) => p.trip_type_tags && p.trip_type_tags.length > 0).length;
  const viaSubcategoryOnly = classified.filter((p) => !p.trip_type_tags?.length && p.subcategory).length;
  const viaTagsOrCuisineOnly = classified.filter(
    (p) => !p.trip_type_tags?.length && !p.subcategory && ((p.tags && p.tags.length > 0) || (p.cuisine_tags && p.cuisine_tags.length > 0))
  ).length;

  const perGroup = TRIP_TYPE_GROUPS.map((g) => ({
    id: g.id,
    emoji: g.emoji,
    label: g.label,
    count: rows.filter((p) => (p.trip_type_tags ?? []).includes(g.id)).length,
  })).sort((a, b) => a.count - b.count);

  // *** ספירה אמיתית סקשן-סקשן, על כל 6 סוגי הטיול שמבוססים על
  // ADMIN_DISCOVERY_SECTIONS (לא abroad/weekend - מנגנון נפרד לגמרי,
  // destination_editions/רדיוס geo, לא שייך לדשבורד הזה).
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
        count: rows.filter((p) => matchesSection(p, section)).length,
      });
    }
  }
  bySection.sort((a, b) => a.count - b.count);
  const emptySections = bySection.filter((s) => s.count === 0);

  return NextResponse.json({
    total,
    uncharacterized: { count: uncharacterized.length, pct: total > 0 ? Math.round((uncharacterized.length / total) * 1000) / 10 : 0, sampleIds: uncharacterized.slice(0, 20).map((p) => p.id) },
    breakdown: { viaTripTypeTags, viaSubcategoryOnly, viaTagsOrCuisineOnly },
    perGroup,
    bySection,
    emptySectionsCount: emptySections.length,
    totalSectionsCount: bySection.length,
  });
}


