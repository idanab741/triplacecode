import { NextResponse } from "next/server";
import { findAirportInfo } from "@/services/tripBuilder/airportInfoService";
import { createClient } from "@/services/supabase/server";

/**
 * מחזיר את שדה התעופה המרכזי של יעד (שם, קואורדינטות, תמונה) - קריאה אחת
 * ללקוח. הלקוח בונה מזה גם את התצוגה וגם קישורי הזמנת נסיעה (Maps directions).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const destination = searchParams.get("destination")?.trim() ?? "";
  if (!destination) return NextResponse.json({ airport: null });

  const supabase = await createClient();
  const airport = await findAirportInfo(supabase, destination);
  return NextResponse.json({ airport });
}
