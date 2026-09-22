import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { toggleCollectionLike } from "@/services/social/collectionService";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  try {
    const liked = await toggleCollectionLike(supabase, id, user.id);
    return NextResponse.json({ liked });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 400 });
  }
}
