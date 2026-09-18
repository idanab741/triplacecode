import { NextResponse } from "next/server";
import { findCentralNeighborhood } from "@/services/tripBuilder/centralNeighborhoodService";
import { geocodePlaceName } from "@/services/tripBuilder/geocodingService";
import { createClient } from "@/services/supabase/server";

/**
 * מחזיר את השכונה המרכזית/התיירותית של יעד (שם, קואורדינטות, תמונה) -
 * לכרטיס יום 1 בחופשה בחו"ל, ולעיגון רדיוס החיפוש של מסעדת יום 1 (עד ק"מ
 * מהשכונה הזו, לא מהמלון). המקור הראשי הוא המאגר הפנימי שלנו (ר'
 * findCentralNeighborhood) - geocoding כאן הוא רק כדי לדעת *איפה* לחפש
 * במאגר, לא כדי להביא את התוצאה עצמה.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const destination = searchParams.get("destination")?.trim() ?? "";
  if (!destination) return NextResponse.json({ neighborhood: null });

  const origin = await geocodePlaceName(destination);
  if (!origin) return NextResponse.json({ neighborhood: null });

  const supabase = await createClient();
  const neighborhood = await findCentralNeighborhood(supabase, { destination, origin, radiusKm: 20 });
  return NextResponse.json({ neighborhood });
}
