import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";

/**
 * בקשה מפורשת ("למה בשורת ההתאמה של האטרקציות והקטגוריות לא מופיע לי
 * כבר האטרקציות ששמורות אצלי? כמו שיש בחופשה בחו"ל???") - אותו עיקרון
 * בדיוק כמו /api/trip-builder/vacation-type-defaults (חופשה בחו"ל), רק
 * ממופה לערכי WEEKEND_STYLE_OPTIONS של שאלון הסופ"ש (שם שדה/ערכים שונה
 * מ-VACATION_TYPE_OPTIONS - ר' ההערה על כך ב-rules/weekend.ts). ממפה את
 * ה-Travel DNA הקיים (interests/preferred_categories/vacation_preferences)
 * מתוך אותו taxonomy כללי (tripTaxonomy.ts) - כדי שהצ'אט יוכל להציג את
 * הכפתורים כבר "לחוצים" מראש. תמיד ניתן לשינוי חופשי בצד המשתמש - זו
 * רק ברירת מחדל.
 */
const TRIP_TAXONOMY_TO_WEEKEND_STYLE: Record<string, string[]> = {
  culture_history: ["culture_art"],
  nature_trails: ["nature_adventure"],
  beaches_pools: ["relax"],
  shopping: ["shopping"],
  wineries_dining: ["culinary"],
  nightlife: ["nightlife"],
  spa_relaxation: ["spa_wellness"],
  sports_extreme: ["sports_extreme"],
  attractions_activities: ["family"],
  viewpoints: ["nature_adventure"],
  parks_gardens: ["nature_adventure"],
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ weekendStyles: [] });

  const dna = await getTravelDna(supabase, user.id);
  if (!dna) return NextResponse.json({ weekendStyles: [] });

  const sourceCategories = [...(dna.preferred_categories ?? []), ...(dna.interests ?? []), ...(dna.vacation_preferences ?? [])];
  const mapped = new Set<string>();
  for (const category of sourceCategories) {
    for (const weekendStyle of TRIP_TAXONOMY_TO_WEEKEND_STYLE[category] ?? []) {
      mapped.add(weekendStyle);
    }
  }

  return NextResponse.json({ weekendStyles: Array.from(mapped) });
}
