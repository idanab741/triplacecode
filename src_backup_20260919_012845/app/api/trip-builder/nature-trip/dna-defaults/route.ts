import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";

/** בקשה מפורשת ("אמשיך לבד -> בונה ישר בהתחשב בהעדפות המשתמש מהפרופיל") -
 *  אותו דפוס כמו day-trip/dna-defaults, ל-natureTypes. */
const VALID_NATURE_TYPES = new Set([
  "springs_streams", "viewpoints_scenery", "forests_groves", "hiking_trails", "seasonal_bloom",
  "caves_phenomena", "desert_canyons", "waterfalls", "wildlife", "sunrise_sunset",
]);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ natureTypes: [] });

  const dna = await getTravelDna(supabase, user.id);
  if (!dna) return NextResponse.json({ natureTypes: [] });

  const sourceCategories = [...(dna.preferred_categories ?? []), ...(dna.interests ?? [])];
  const natureTypes = Array.from(new Set(sourceCategories.filter((c) => VALID_NATURE_TYPES.has(c))));

  return NextResponse.json({ natureTypes });
}
