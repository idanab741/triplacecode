import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getSuggestedTravelers } from "@/services/social/suggestedTravelersService";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const travelers = await getSuggestedTravelers(supabase, user.id);
  return NextResponse.json({ travelers });
}
