import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { toggleSocialSave } from "@/services/social/postService";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  const saved = await toggleSocialSave(supabase, user.id, "post", id);
  return NextResponse.json({ saved });
}
