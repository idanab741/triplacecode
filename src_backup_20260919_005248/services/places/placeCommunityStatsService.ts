import { createAdminClient } from "@/services/supabase/admin";

export interface PlaceCommunityStats {
  /** כמה משתמשים החליקו ימינה ("אהבתי") על המקום הזה ב-TripMatch -
   *  favorites: status="liked", source="tripmatch". */
  likedCount: number;
  /** כמה משתמשים החליקו שמאלה ("לא אהבתי") על המקום הזה ב-TripMatch.
   *  *** הערה: נכון להיום, החלקה שמאלה ב-TripMatch (ר' /api/tripmatch/
   *  sessions/[sessionId]/decide/route.ts) נשמרת רק במערך
   *  rejected_place_ids של ה-session הספציפי (tripmatch_sessions) -
   *  לא בטבלת favorites (בניגוד להחלקה ימינה, שכן נשמרת שם). לכן
   *  הספירה כאן מבוססת על tripmatch_sessions, לא favorites - מקור
   *  הנתונים היחיד שקיים בפועל לפעולה הזו כרגע. */
  dislikedCount: number;
  /** כמה משתמשים שמרו (❤️) את המקום הזה - favorites: status="saved",
   *  מכל מקור (עמוד אטרקציה/תוצאת חיפוש/כל מקום עתידי אחר עם אותה
   *  פעולת "שמור" גנרית - ר' PlaceHeroActions.tsx). */
  savedCount: number;
}

/**
 * *** תוספת (בקשה מפורשת - "נתונים על האטרקציה - כמה אהבו/לא אהבו/
 * שמרו"): שאילתת ספירה חוצת-משתמשים (community-wide), לא רק "מה
 * המשתמש המחובר עשה". favorites כפוף ל-RLS לפי auth.uid()=user_id
 * (ר' migration 0006) - שאילתה רגילה (createClient, לא admin) הייתה
 * מחזירה 0 בפועל לכל מי שלא המשתמש עצמו. לכן admin client
 * (service_role, עוקף RLS) - בדיוק כמו /api/trippy-ai/shared/[token]/
 * route.ts. חשוב: מוחזרים כאן **רק מספרים מצטברים**, לעולם לא זהות/
 * userId של אף משתמש - שום מידע פרטי לא נחשף.
 */
export async function getPlaceCommunityStats(placeId: string): Promise<PlaceCommunityStats> {
  const admin = createAdminClient();

  const [likedResult, savedResult, rejectedResult] = await Promise.all([
    admin
      .from("favorites")
      .select("id", { count: "exact", head: true })
      .eq("place_id", placeId)
      .eq("place_type", "place")
      .eq("status", "liked")
      .eq("source", "tripmatch"),
    admin
      .from("favorites")
      .select("id", { count: "exact", head: true })
      .eq("place_id", placeId)
      .eq("place_type", "place")
      .eq("status", "saved"),
    // *** containment (@>) על rejected_place_ids - ר' הערה על
    // dislikedCount למעלה. נספר לפי user_id ייחודי (לא לפי מספר
    // sessions) - אותו משתמש שדחה את אותו מקום בכמה sessions שונים
    // (למשל פתח TripMatch כמה פעמים) נספר פעם אחת בלבד, כדי שהמספר
    // ישקף "כמה אנשים" ולא "כמה סשנים".
    admin.from("tripmatch_sessions").select("user_id").contains("rejected_place_ids", [placeId]),
  ]);

  const dislikedUserIds = new Set((rejectedResult.data ?? []).map((row) => row.user_id as string));

  return {
    likedCount: likedResult.count ?? 0,
    savedCount: savedResult.count ?? 0,
    dislikedCount: dislikedUserIds.size,
  };
}
