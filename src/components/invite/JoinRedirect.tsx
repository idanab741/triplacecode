"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { storePendingInviteCode } from "@/services/invite/inviteService";

interface JoinRedirectProps {
  code: string;
}

/**
 * צד ה"קליטה" של לינק ההזמנה - /join/<code>. זו נקודת הכניסה הציבורית
 * שכל חבר שמקבל לינק הזמנה מגיע אליה בפועל (ר' proxy.ts - הנתיב הזה
 * *לא* מוגן, בכוונה, כדי שמי שעדיין לא רשום יוכל להגיע אליו).
 *
 * שומר את קוד ההזמנה בדפדפן (כדי ש-/auth יוכל לפדות אותו אחרי הרשמה
 * מוצלחת - ר' redeem_invite ב-migration 0061 + inviteService.ts), ואז:
 * - משתמש שלא מחובר -> מועבר למסך הרשמה (טאב signup, ברירת המחדל).
 * - משתמש שכבר מחובר -> אין צורך בהרשמה, מועבר ישר הביתה.
 */
export function JoinRedirect({ code }: JoinRedirectProps) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (code) storePendingInviteCode(code);
  }, [code]);

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace("/home");
    } else {
      router.replace(`/auth?ref=${encodeURIComponent(code)}`);
    }
  }, [loading, user, code, router]);

  return null;
}
