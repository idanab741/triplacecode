import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { markStoryViewed, getStoryViewers } from "@/services/social/storyService";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  await markStoryViewed(supabase, id, user.id);
  return NextResponse.json({ success: true });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  const viewers = await getStoryViewers(supabase, id);
  return NextResponse.json({ viewers });
}
