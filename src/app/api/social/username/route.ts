import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { setUsername } from "@/services/social/socialProfileService";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const username = body?.username as string | undefined;
  if (!username) return NextResponse.json({ error: "חסר username" }, { status: 422 });

  try {
    await setUsername(supabase, user.id, username);
    return NextResponse.json({ username });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 400 });
  }
}
