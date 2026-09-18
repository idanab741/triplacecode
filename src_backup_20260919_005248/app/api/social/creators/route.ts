import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getSuggestedCreators } from "@/services/social/creatorDiscoveryService";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const creators = await getSuggestedCreators(supabase, user.id);
  return NextResponse.json({ creators });
}
