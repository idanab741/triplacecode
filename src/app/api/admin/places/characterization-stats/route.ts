import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { TRIP_TYPE_GROUPS } from "@/services/places/tripTaxonomy";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/**
 * דשבורד "כמה אטרקציות לא מאופיינות" (דרישה מפורשת). place.trip_type_tags
 * הוא השדה היחיד שבפועל קובע אם מקום *יכול בכלל* להופיע במסך "סוגי
 * מסלול" (curated/sections/domestic) - ר' placeMatchesSection/
 * fetchDiscoveryPlaces. מקום עם trip_type_tags ריק לא נראה **בשום
 * מקום**, גם אם יש לו category/subcategory תקינים - זו בדיוק הסיבה
 * הסבירה ביותר לסקשנים ריקים (לדוגמה "דייט רומנטי"/"טיול בטבע") -
 * לא באג בקוד, אלא פער באפיון הנתונים עצמם.
 */
export async function GET(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: places, error } = await supabase
    .from("places")
    .select("id,category,subcategory,trip_type_tags,city,is_legacy")
    .eq("is_legacy", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (places ?? []) as { id: string; category: string | null; subcategory: string | null; trip_type_tags: string[] | null; city: string | null }[];

  const total = rows.length;
  const uncharacterized = rows.filter((p) => !p.trip_type_tags || p.trip_type_tags.length === 0);
  const noSubcategory = rows.filter((p) => !p.subcategory);
  const noCategory = rows.filter((p) => !p.category);
  const noCity = rows.filter((p) => !p.city);

  const perGroup = TRIP_TYPE_GROUPS.map((g) => ({
    id: g.id,
    emoji: g.emoji,
    label: g.label,
    count: rows.filter((p) => (p.trip_type_tags ?? []).includes(g.id)).length,
  })).sort((a, b) => a.count - b.count);

  return NextResponse.json({
    total,
    uncharacterized: { count: uncharacterized.length, pct: total > 0 ? Math.round((uncharacterized.length / total) * 1000) / 10 : 0, sampleIds: uncharacterized.slice(0, 20).map((p) => p.id) },
    noSubcategory: { count: noSubcategory.length, pct: total > 0 ? Math.round((noSubcategory.length / total) * 1000) / 10 : 0 },
    noCategory: { count: noCategory.length },
    noCity: { count: noCity.length },
    perGroup,
  });
}
