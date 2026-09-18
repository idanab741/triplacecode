import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";

/** בקשה מפורשת ("אמשיך לבד -> בונה ישר בהתחשב בהעדפות המשתמש מהפרופיל
 *  או גנרי") - בשונה מ-vacation-type-defaults (חופשה בחו"ל, שדורש מיפוי
 *  כי VACATION_TYPE_OPTIONS הם ערכים שונים) - DAY_TRIP_INTEREST_OPTIONS
 *  כבר משתמש באותם ערכי trip_type_tags בדיוק כמו ה-DNA (coffee_carts_cafes,
 *  nature_trails וכו') - לא צריך שום טבלת מיפוי, רק סינון לערכים חוקיים. */
const VALID_DAY_TRIP_INTERESTS = new Set([
  "coffee_carts_cafes", "nature_trails", "beaches_pools", "viewpoints", "parks_gardens",
  "water_amusement_parks", "attractions_activities", "sports_extreme", "wineries_dining", "culture_history",
]);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ interests: [] });

  const dna = await getTravelDna(supabase, user.id);
  if (!dna) return NextResponse.json({ interests: [] });

  const sourceCategories = [...(dna.preferred_categories ?? []), ...(dna.interests ?? [])];
  const interests = Array.from(new Set(sourceCategories.filter((c) => VALID_DAY_TRIP_INTERESTS.has(c))));

  return NextResponse.json({ interests });
}
