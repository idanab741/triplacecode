import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getProfileByUsername } from "@/services/social/socialProfileService";

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { username } = await params;
  const profile = await getProfileByUsername(supabase, username, user?.id ?? null);
  if (!profile) return NextResponse.json({ error: "פרופיל לא נמצא" }, { status: 404 });
  return NextResponse.json({ profile });
}
