import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTripMatchSession, recordTripMatchDecision, fetchTripMatchCandidates } from "@/services/tripMatch/tripMatchService";
import { toggleFavorite } from "@/services/favorites/favoritesService";
import { consumeTokens, refundTokens, TOKEN_COSTS } from "@/services/tokens/tokenService";

const LIKE_COST = TOKEN_COSTS.tripmatch_like;

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const placeId: string | undefined = body?.placeId;
  const liked: boolean | undefined = body?.liked;
  if (!placeId || typeof liked !== "boolean") {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const session = await getTripMatchSession(supabase, sessionId);
  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "session לא נמצא" }, { status: 404 });
  }

  // *** מערכת "טריפים" (ר' migration 0063 + services/tokens/tokenService.ts):
  // רק Like/החלקה ימינה עולה טריפים - Skip (liked=false) לא עולה כלום,
  // וממשיך בדיוק כמו קודם, בלי שום שינוי.
  //
  // referenceId יציב (session+place) הוא ההגנה מפני חיוב כפול (double
  // click / swipe כפול / retry) - ניסיון שני עם אותו placeId בדיוק
  // ב-session הזה מקבל alreadyCharged:true מ-consumeTokens בלי לחייב
  // שוב, ללא תלות בבדיקת ה-liked_place_ids (הישנה, לא-אטומית) ב-
  // recordTripMatchDecision.
  //
  // סדר הפעולות: קודם חיוב אטומי (חוסם overspending גם במרוץ בין שתי
  // בקשות מקבילות), ורק אם הוא הצליח - recordTripMatchDecision/
  // toggleFavorite בפועל. אם הפעולה בכל זאת נכשלת אחרי חיוב מוצלח -
  // מחזירים (refund) את הטריפים, כי "לא לחייב אם הפעולה נכשלה".
  let tokenBalance: number | null = null;

  if (liked) {
    const referenceId = `tripmatch_like:${sessionId}:${placeId}`;
    let charge;
    try {
      charge = await consumeTokens(user.id, LIKE_COST, "tripmatch_like", referenceId);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "שגיאה בבדיקת יתרת הטריפים" }, { status: 500 });
    }

    if (!charge.success) {
      return NextResponse.json(
        { error: "INSUFFICIENT_TOKENS", cost: LIKE_COST, remainingTokens: charge.balance },
        { status: 402 }
      );
    }
    tokenBalance = charge.balance;

    try {
      await recordTripMatchDecision(supabase, sessionId, placeId, liked);
      await toggleFavorite(supabase, user.id, placeId, "place", "liked", "tripmatch").catch(() => {});
    } catch (e) {
      // הפעולה שהחיוב מימן לא הצליחה בפועל - מחזירים את הטריפים.
      // לא-פעולה אם היה alreadyCharged (retry לגיטימי) - אין מה להחזיר.
      if (!charge.alreadyCharged) {
        await refundTokens(user.id, LIKE_COST, "tripmatch_like_refund", `${referenceId}:refund`).catch((refundError) => {
          console.error("[tripmatch/decide] refund failed:", refundError);
        });
      }
      return NextResponse.json({ error: e instanceof Error ? e.message : "שמירת ה-Like נכשלה" }, { status: 500 });
    }
  } else {
    await recordTripMatchDecision(supabase, sessionId, placeId, liked);
  }

  const updatedSession = await getTripMatchSession(supabase, sessionId);
  const candidates = updatedSession ? await fetchTripMatchCandidates(supabase, updatedSession) : [];

  return NextResponse.json({ candidates, tokenBalance });
}

