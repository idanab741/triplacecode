import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTokenBalance, MONTHLY_TOKEN_ALLOWANCE } from "@/services/tokens/tokenService";
import { UNLIMITED_TRIPS_PROMO } from "@/constants/tokenCosts";

/** יתרת "טריפים" של המשתמש המחובר (ר' migration 0063 + services/tokens/tokenService.ts).
 *  קוראת מהשרת בכל פעם - אין הסתמכות על נתון ישן ב-client (דרישה מפורשת). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  try {
    const { balance, cycleStart } = await getTokenBalance(user.id);
    return NextResponse.json({ balance, cycleStart, allowance: MONTHLY_TOKEN_ALLOWANCE, unlimited: UNLIMITED_TRIPS_PROMO });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "טעינת היתרה נכשלה" }, { status: 500 });
  }
}
