import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getSavedTrips } from "@/services/tripBuilder/savedTripsService";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const trips = await getSavedTrips(supabase, user.id);
  return NextResponse.json({ trips });
}
