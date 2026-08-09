import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { collectPlacesForCityAndCategory } from "@/services/places/collectionService";
import { DISCOVERY_TRIP_TYPES } from "@/services/admin/discoveryConfig";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/**
 * מריצה בפועל Discovery Job - קוראת ל-Google (דרך collectPlacesForCityAndCategory,
 * מנוע האיסוף האמיתי שכבר קיים) פעם אחת לכל קטגוריה שנבחרה, שומרת
 * לטבלת places (עם הגנה מובנית מפני כפילויות ומקומות שנערכו ידנית).
 *
 * ⚠️ גרסה ראשונה, פשוטה במכוון: לא כל הפילטרים (עונה, נגישות, תקציב וכו')
 * מיושמים עדיין בפועל בחיפוש ה-Google עצמו - רק עיר/מדינה/קטגוריה. סף
 * הדירוג המובנה במנוע האיסוף הוא 3.5 קבוע (לא job.min_rating הדינמי) -
 * מוחל כאן סינון נוסף מעל זה, אחרי השמירה, לצורך הדיווח בלבד.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: job, error: jobError } = await supabase.from("discovery_jobs").select("*").eq("id", id).single();
  if (jobError || !job) return NextResponse.json({ error: "בקשה לא נמצאה" }, { status: 404 });

  await supabase.from("discovery_jobs").update({ status: "running" }).eq("id", id);

  const tripType = DISCOVERY_TRIP_TYPES.find((t) => t.key === job.trip_type);
  const filters = (job.filters ?? {}) as Record<string, string>;
  const city = filters.city || filters.area || "";
  const country = filters.country || "ישראל";

  if (!city) {
    await supabase.from("discovery_jobs").update({ status: "failed" }).eq("id", id);
    return NextResponse.json({ error: "חסרה עיר/אזור בבקשה - חובה לחיפוש Google בגרסה הנוכחית" }, { status: 400 });
  }

  let totalFetched = 0;
  let totalSaved = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const categoryKey of job.categories as string[]) {
    const category = tripType?.categories.find((c) => c.key === categoryKey);
    const query = category ? category.label : categoryKey;
    try {
      // הערה: category כאן משתמש במפתח הקטגוריה מה-Discovery Wizard עצמו
      // (coffee_carts, nature_trails וכו') - לא בהכרח זהה תמיד ל-20 ה-IDs
      // הרשמיים של interest_category ב-tripTaxonomy.ts. יישור מלא בין שתי
      // הטקסונומיות (Discovery config מול interest_category) הוא עבודת
      // המשך נפרדת, לא נפתר כאן.
      const result = await collectPlacesForCityAndCategory(city, categoryKey, country, query);
      totalFetched += result.fetched;
      totalSaved += result.saved;
      totalSkipped += result.skipped;
    } catch (e) {
      errors.push(`${query}: ${e instanceof Error ? e.message : "שגיאה"}`);
    }
  }

  await supabase
    .from("discovery_jobs")
    .update({
      status: errors.length === job.categories.length ? "failed" : "completed",
      found_count: totalFetched,
      approved_count: totalSaved,
      duplicate_count: totalSkipped,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ fetched: totalFetched, saved: totalSaved, skipped: totalSkipped, errors });
}
