"use client";

import { useEffect, useState } from "react";

interface BalanceState {
  balance: number;
  allowance: number;
}

/**
 * תצוגת יתרת "טריפים" - מתחת לשם המשתמש בפרופיל (דרישה מפורשת #13).
 * נטענת תמיד מהשרת (לא state גלובלי/localStorage - מקור אמת יחיד, ר'
 * services/tokens/tokenService.ts) בכל טעינה/מעבר מחדש לעמוד, כדי
 * שהיתרה תמיד תשקף שימוש שקרה במסכים אחרים (Trippy AI/TripMatch).
 * כשל בטעינה לא מציג באנר שגיאה - זה widget משני, לא חוסם את שאר הפרופיל.
 */
export function TokenBalancePill() {
  const [state, setState] = useState<BalanceState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tokens/balance")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "טעינת היתרה נכשלה");
        if (!cancelled) setState({ balance: data.balance, allowance: data.allowance });
      })
      .catch(() => {
        // widget משני - כשל בטעינה לא אמור לשבש את שאר עמוד הפרופיל
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="h-6 w-28 animate-pulse rounded-pill bg-bg-secondary" />;
  }
  if (!state) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-bg-secondary px-3 py-1 text-xs font-semibold text-ink-secondary">
      ✦ {state.balance} / {state.allowance} טריפים
    </span>
  );
}
