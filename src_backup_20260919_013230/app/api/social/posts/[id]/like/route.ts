import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { toggleLike } from "@/services/social/postService";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  const liked = await toggleLike(supabase, id, user.id);
  return NextResponse.json({ liked });
}
