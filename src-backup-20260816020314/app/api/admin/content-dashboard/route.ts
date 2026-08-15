import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** מיפוי מודול -> ערכי category רלוונטיים בטבלת places. אין כאן ניחוש -
 *  אלה בדיוק אותם category IDs שכבר בשימוש בקוד (rules/*.ts,
 *  tripTaxonomy.ts). מודולים בלי "category" ייעודי (חופשה בחו"ל, סופ"ש)
 *  לא מסננים לפי category בכלל - הם רב-תחומיים מטבעם.
 */
const MODULE_CATEGORIES: Record<string, string[] | null> = {
  day_trip: null, // רב-תחומי - כל הקטגוריות רלוונטיות
  nature_trip: ["nature_trail", "beach_water"],
  weekend: null,
  restaurants_cafes: ["restaurants_cafes"],
  romantic_date: null,
  nightlife: ["bar"],
  abroad_vacation: null,
  tripmatch: null,
};

const MODULE_LABELS: Record<string, string> = {
  day_trip: "טיול יומי",
  nature_trip: "טיול בטבע",
  weekend: "סופ\"ש",
  restaurants_cafes: "מסעדות ובתי קפה",
  romantic_date: "דייט רומנטי",
  nightlife: "חיי לילה ובילויים",
  abroad_vacation: "חופשה בחו\"ל",
  tripmatch: "TripMatch",
};

/** "חסרה התאמה" = לא עבר סיווג AI בכלל (trip_type_tags וגם dna_tags ריקים) -
 *  לא "השדות לא מושלמים באחוז מסוים", אלא "אף פעם לא נותח". הגדרה שמרנית
 *  בכוונה - עדיף לפספס מקום שכן תויג חלקית מאשר להציף עם false positives. */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { count: totalPlaces } = await supabase.from("places").select("id", { count: "exact", head: true });

  const modules = await Promise.all(
    Object.entries(MODULE_CATEGORIES).map(async ([moduleKey, categories]) => {
      if (moduleKey === "tripmatch") {
        // TripMatch לא מסונן לפי category - הוא כל מקום שסומן dna_tags
        // כולל תגית TripMatch-relevant. כרגע אין הפרדה כזו בפועל, אז
        // מחזירים 0/0 עד שתוחלט הלוגיקה המדויקת (מוזכר ב-Audit).
        return { module: moduleKey, label: MODULE_LABELS[moduleKey], total: 0, missingMatches: 0 };
      }

      let totalQuery = supabase.from("places").select("id", { count: "exact", head: true });
      let missingQuery = supabase
        .from("places")
        .select("id", { count: "exact", head: true })
        .or("trip_type_tags.is.null,trip_type_tags.eq.{}")
        .or("dna_tags.is.null,dna_tags.eq.{}");

      if (categories) {
        totalQuery = totalQuery.in("category", categories);
        missingQuery = missingQuery.in("category", categories);
      }

      const [{ count: total }, { count: missingMatches }] = await Promise.all([totalQuery, missingQuery]);

      return { module: moduleKey, label: MODULE_LABELS[moduleKey], total: total ?? 0, missingMatches: missingMatches ?? 0 };
    })
  );

  return NextResponse.json({ totalPlaces: totalPlaces ?? 0, modules });
}
