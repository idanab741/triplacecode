import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { ensureUsername } from "@/services/social/socialProfileService";

/** יוצר/מחזיר username אוטומטית בלי לשאול את המשתמש - נקרא מ-/places/profile/me
 *  בפעם הראשונה שאין עדיין username, כדי שלא יופיע מסך "בחר שם משתמש" חוסם. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  try {
    const username = await ensureUsername(supabase, user.id);
    return NextResponse.json({ username });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 500 });
  }
}
