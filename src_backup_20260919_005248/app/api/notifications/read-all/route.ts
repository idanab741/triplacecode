import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getActivityFeed, markActivitiesRead } from "@/services/notifications/notificationsService";

/** מסמן את כל הפעילות הלא-נקראת של המשתמש כנקראה. במכוון לא מסתמך על
 *  רשימת activityKeys מהלקוח (שעלולה להיות חלקית/לא-מסונכרנת) - שולף
 *  מחדש את הפיד המלא בצד השרת (אותו מקור-אמת יחיד, ר' getActivityFeed)
 *  ומסמן את מה שבאמת לא-נקרא כרגע. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { items } = await getActivityFeed(supabase, user.id, "all");
  const unreadKeys = items.filter((i) => !i.isRead).map((i) => i.id);
  const result = await markActivitiesRead(supabase, user.id, unreadKeys);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error ?? "השמירה נכשלה" }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: unreadKeys.length });
}
