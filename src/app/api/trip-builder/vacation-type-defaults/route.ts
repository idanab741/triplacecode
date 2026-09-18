import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";

/**
 * בקשה מפורשת ("אני רוצה שיופיע כבר עם כל ההעדפות של המשתמש שמסומנות"):
 * ממפה את ה-Travel DNA הקיים (interests/preferred_categories/vacation_preferences -
 * קטגוריות מטבע ה-taxonomy הכללי, tripTaxonomy.ts) לערכי VACATION_TYPE_OPTIONS
 * הספציפיים של שאלון חופשה בחו"ל - כדי שהצ'אט יוכל להציג את הכפתורים
 * כבר "לחוצים" מראש, בלי לגעת בקוד השרת הראשי (auto-build) בכלל. תמיד
 * ניתן לשינוי חופשי בצד המשתמש - זו רק ברירת מחדל.
 */
const TRIP_TAXONOMY_TO_VACATION_TYPE: Record<string, string[]> = {
  culture_history: ["museums_history", "culture_art"],
  nature_trails: ["nature_adventure"],
  beaches_pools: ["relax"],
  shopping: ["shopping"],
  wineries_dining: ["culinary"],
  nightlife: ["nightlife"],
  spa_relaxation: ["spa_wellness"],
  sports_extreme: ["sports_extreme", "ski"],
  attractions_activities: ["urban", "family"],
  viewpoints: ["urban"],
  parks_gardens: ["nature_adventure"],
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ vacationTypes: [] });

  const dna = await getTravelDna(supabase, user.id);
  if (!dna) return NextResponse.json({ vacationTypes: [] });

  const sourceCategories = [...(dna.preferred_categories ?? []), ...(dna.interests ?? []), ...(dna.vacation_preferences ?? [])];
  const mapped = new Set<string>();
  for (const category of sourceCategories) {
    for (const vacationType of TRIP_TAXONOMY_TO_VACATION_TYPE[category] ?? []) {
      mapped.add(vacationType);
    }
  }

  return NextResponse.json({ vacationTypes: Array.from(mapped) });
}
