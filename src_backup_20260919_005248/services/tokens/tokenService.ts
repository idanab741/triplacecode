import { createAdminClient } from "@/services/supabase/admin";
import { MONTHLY_TOKEN_ALLOWANCE, TOKEN_COSTS, type TokenActionType } from "@/constants/tokenCosts";

export { MONTHLY_TOKEN_ALLOWANCE, TOKEN_COSTS, type TokenActionType };

/**
 * שירות מרכזי למערכת "טריפים" (Tokens) - ר' migration 0063. זהו ה-Single
 * Source of Truth היחיד: כל בדיקה/חיוב/החזר של טריפים בכל האפליקציה
 * (Trippy AI, TripMatch, ובעתיד כל פעולה נוספת) עובר אך ורק דרך הפונקציות
 * כאן - אסור לשכפל את הלוגיקה הזו בתוך route handlers בודדים.
 *
 * *** שרת בלבד: משתמש ב-createAdminClient (service_role) כי ה-RPCs
 * ב-DB מוגנות בכוונה מפני קריאה ישירה מה-client (ר' migration 0063 -
 * revoke/grant בסוף הקובץ) - p_user_id הוא פרמטר מפורש, אז חובה
 * שהקוד שקורא לו כבר אימת בעצמו מי המשתמש המחובר (auth.getUser())
 * *לפני* שהוא קורא לפונקציות כאן. לעולם אין לייבא את הקובץ הזה
 * מתוך קומפוננטת "use client".
 */

export interface TokenBalance {
  balance: number;
  cycleStart: string;
}

export interface ConsumeTokensResult {
  success: boolean;
  alreadyCharged: boolean;
  balance: number;
  error?: "INSUFFICIENT_TOKENS";
}

interface TokenBalanceRow {
  user_id: string;
  balance: number;
  cycle_start: string;
  updated_at: string;
}

/** שולף (ומוודא מחזור עדכני, כולל reset אוטומטי אם צריך) את היתרה
 *  הנוכחית של המשתמש. משתמש חדש מקבל אוטומטית 100/100. */
export async function getTokenBalance(userId: string): Promise<TokenBalance> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("ensure_token_cycle", { p_user_id: userId });
  if (error) throw new Error(`getTokenBalance: ${error.message}`);
  const row = data as TokenBalanceRow;
  return { balance: row.balance, cycleStart: row.cycle_start };
}

/** בדיקה מקדימה (לא-מחייבת) - שימושית לתת ל-UI הודעת "אין מספיק טריפים"
 *  ברורה *לפני* שמנסים לבצע פעולה יקרה (למשל קריאת AI). אינה תחליף
 *  לבדיקה האטומית האמיתית בתוך consumeTokens - עדיין ייתכן מרוץ בין
 *  הבדיקה הזו לחיוב בפועל, ולכן consumeTokens *תמיד* בודק שוב באופן
 *  אטומי בעצמו, בלי להסתמך על התוצאה של הפונקציה הזו. */
export async function canConsumeTokens(userId: string, amount: number): Promise<{ canAfford: boolean; balance: number }> {
  const { balance } = await getTokenBalance(userId);
  return { canAfford: balance >= amount, balance };
}

/**
 * מחייבת טריפים בפועל - אטומית ואידמפוטנטית (ר' migration 0063,
 * consume_tokens). referenceId, כשיש מפתח יציב וטבעי (למשל
 * `tripmatch_like:<sessionId>:<placeId>`), מבטיח שאותה פעולה בדיוק
 * (double click / retry / request כפול) לעולם לא תחויב פעמיים -
 * ניסיון שני עם אותו referenceId מחזיר alreadyCharged:true בלי לחייב שוב.
 */
export async function consumeTokens(
  userId: string,
  amount: number,
  type: TokenActionType | (string & {}),
  referenceId?: string | null
): Promise<ConsumeTokensResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("consume_tokens", {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_reference_id: referenceId ?? null,
  });
  if (error) throw new Error(`consumeTokens: ${error.message}`);
  return data as ConsumeTokensResult;
}

/**
 * פעולת פיצוי (compensating transaction) - נקראת רק כשחיוב הצליח אך
 * הפעולה שהוא מימן נכשלה בפועל אחרי מכן (דרישה מפורשת - "אין לחייב
 * אם הפעולה נכשלה"). best-effort: כשל ברענון לא אמור להפיל את
 * הבקשה המקורית - נכשל בשקט ומדווח ב-console (ר' קריאה בכל route).
 */
export async function refundTokens(
  userId: string,
  amount: number,
  type: string,
  referenceId?: string | null
): Promise<{ success: boolean; balance: number }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("refund_tokens", {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_reference_id: referenceId ?? null,
  });
  if (error) throw new Error(`refundTokens: ${error.message}`);
  return data as { success: boolean; balance: number };
}
