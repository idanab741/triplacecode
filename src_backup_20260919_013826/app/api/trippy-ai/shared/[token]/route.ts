import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

/**
 * *** תוספת (בקשה מפורשת - "אפשרות לשמירה ושיתוף"): צפייה ציבורית
 * (בלי התחברות) בתוצאה שמורה אחת, לפי share_token אקראי ולא-ניחושי
 * (ר' migration 0058). קורא עם service_role (createAdminClient, עוקף
 * RLS) - **מכוון** - ה-RLS הרגילה מוגבלת ל-auth.uid()=user_id, שלא
 * מתאים כלל לגישה ציבורית. הבטיחות כאן מגיעה מסינון מדויק לפי טוקן
 * (uuid אקראי, לא ניתן לניחוש/מספור) ולא מ-RLS - אף שורה אחרת לא
 * נחשפת, גם לא בטעות.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("trippy_ai_results")
    .select("id,title,stops,search_context,created_at")
    .eq("share_token", token)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "המסלול לא נמצא" }, { status: 404 });
  return NextResponse.json({ result: data });
}
