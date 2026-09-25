import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { addPlacesToTrip, TripInputError } from "@/services/social/tripService";

/** הוספה מהירה של תחנות לטיול קיים ({ placeIds, day? }) - רק היוצר (נאכף בשירות וב-replace_trip_stops). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  const body = ((await request.json().catch(() => null)) ?? {}) as { placeIds?: unknown; day?: unknown };
  try {
    return NextResponse.json(await addPlacesToTrip(supabase, user.id, id, body.placeIds, body.day));
  } catch (err) {
    if (err instanceof TripInputError) return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בהוספה לטיול" }, { status: 400 });
  }
}
