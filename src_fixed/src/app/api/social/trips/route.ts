import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { TripInputError, createTrip, parseTripInput } from "@/services/social/tripService";

/** יצירת (ופרסום) טיול. גוף הבקשה: { title, description?, coverUrl?, tripType?, visibility?, days: [{ stops: [{ placeId, note? }] }] }.
 *  טיול חייב שם + לפחות 2 תחנות (ר' parseTripInput). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  try {
    const input = parseTripInput(body);
    const id = await createTrip(supabase, user.id, input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof TripInputError) return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה ביצירת הטיול" }, { status: 400 });
  }
}
