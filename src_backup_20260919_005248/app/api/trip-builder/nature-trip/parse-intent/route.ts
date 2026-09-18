import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { extractNatureTripIntent } from "@/services/tripBuilder/natureTripIntentExtractionService";

/** אותו דפוס בדיוק כמו /api/trip-builder/day-trip/parse-intent, ליעד הטבע. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const freeText = typeof body?.freeText === "string" ? body.freeText : "";

  if (!freeText.trim()) {
    return NextResponse.json({ error: "יש לספק freeText" }, { status: 400 });
  }

  const extracted = await extractNatureTripIntent(freeText);
  return NextResponse.json({ extracted });
}
