import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getProfileContent } from "@/services/social/profileContentService";
import { PROFILE_CONTENT_FILTERS, type ProfileContentFilter } from "@/services/social/profileContentTypes";

/** תוכן הפרופיל כ-Grid: ?kind=all|post|review|collection|trip&cursor=... (ר' profileContentService). */
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { username } = await params;
  const { data: profile } = await supabase.from("profiles").select("id").ilike("username", username).maybeSingle();
  if (!profile) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

  const search = new URL(request.url).searchParams;
  const kind = (search.get("kind") ?? "all") as ProfileContentFilter;
  if (!PROFILE_CONTENT_FILTERS.includes(kind)) return NextResponse.json({ error: "סוג לא תקין" }, { status: 422 });

  try {
    const { tiles, nextCursor } = await getProfileContent(supabase, profile.id, kind, search.get("cursor") ?? undefined);
    return NextResponse.json({ tiles, nextCursor });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בטעינת התוכן" }, { status: 500 });
  }
}
