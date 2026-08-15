import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getSavedTrips } from "@/services/tripBuilder/savedTripsService";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const savedOnly = searchParams.get("all") !== "true";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const trips = await getSavedTrips(supabase, user.id, { savedOnly, limit });
  return NextResponse.json({ trips });
}
