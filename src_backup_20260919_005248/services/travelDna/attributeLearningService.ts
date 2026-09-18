import type { SupabaseClient } from "@supabase/supabase-js";

const LIKE_DELTA = 10;
const UNLIKE_DELTA = -4;
const MIN_SCORE = -100;
const MAX_SCORE = 100;

/**
 * מעדכן ניקוד דינמי לכל מאפייני המקום (קטגוריה + כל התגיות) לפי Like/Unjike
 * אחד. שינוי עדין ולא חד - "אין להסיק מסקנות חדות מהחלקה בודדת" (לפי מסמך
 * מנוע ההחלקות). מצטבר לאורך זמן לכדי Travel DNA אמיתי.
 */
export async function recordSwipeSignal(
  supabase: SupabaseClient,
  userId: string,
  placeId: string,
  liked: boolean
): Promise<void> {
  const { data: place } = await supabase
    .from("places")
    .select("category, tags")
    .eq("id", placeId)
    .maybeSingle();

  if (!place) return;

  const attributes = Array.from(
    new Set([place.category as string, ...(((place.tags as string[]) ?? []))])
  ).filter(Boolean);
  if (attributes.length === 0) return;

  const delta = liked ? LIKE_DELTA : UNLIKE_DELTA;

  for (const attribute of attributes) {
    const { data: existing } = await supabase
      .from("user_attribute_scores")
      .select("score")
      .eq("user_id", userId)
      .eq("attribute", attribute)
      .maybeSingle();

    const nextScore = Math.max(MIN_SCORE, Math.min(MAX_SCORE, (existing?.score ?? 0) + delta));

    await supabase
      .from("user_attribute_scores")
      .upsert(
        { user_id: userId, attribute, score: nextScore, updated_at: new Date().toISOString() },
        { onConflict: "user_id,attribute" }
      );
  }
}

export interface AttributeScore {
  attribute: string;
  score: number;
}

/** כל הציונים הנלמדים על המשתמש - למפה מהירה, לשימוש בדירוג ובפרומפט ל-Claude. */
export async function getAttributeScoreMap(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, number>> {
  const { data } = await supabase.from("user_attribute_scores").select("attribute, score").eq("user_id", userId);
  return new Map((data ?? []).map((row) => [row.attribute as string, row.score as number]));
}

/** המאפיינים המובילים (חיוביים ושליליים) - לתיאור קצר בפרומפט של Claude. */
export function summarizeTopAttributes(
  scoreMap: Map<string, number>,
  limit = 8
): { liked: string[]; disliked: string[] } {
  const entries = Array.from(scoreMap.entries());
  const liked = entries
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([attr]) => attr);
  const disliked = entries
    .filter(([, score]) => score < 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([attr]) => attr);
  return { liked, disliked };
}