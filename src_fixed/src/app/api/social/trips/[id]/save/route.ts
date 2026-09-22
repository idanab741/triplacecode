import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { toggleSocialSave } from "@/services/social/postService";

/** Save של טיול = רישום ב-social_saves הקיימת (target_type='trip'). לא משכפל את הטיול -
 *  הוא נשאר שייך ליוצר המקורי (trips.author_id). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  try {
    const saved = await toggleSocialSave(supabase, user.id, "trip", id);
    return NextResponse.json({ saved });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 400 });
  }
}
