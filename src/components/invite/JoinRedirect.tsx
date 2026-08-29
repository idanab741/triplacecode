"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { storePendingInviteCode } from "@/services/invite/inviteService";
import { detectDevicePlatform } from "@/utils/detectDevicePlatform";

interface JoinRedirectProps {
  code: string;
}

const IOS_APP_STORE_URL = process.env.NEXT_PUBLIC_IOS_APP_STORE_URL;
const ANDROID_PLAY_STORE_URL = process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL;

/**
 * צד ה"קליטה" של לינק ההזמנה - /join/<code>. זו נקודת הכניסה הציבורית
 * שכל חבר שמקבל לינק הזמנה מגיע אליה בפועל (ר' proxy.ts - הנתיב הזה
 * *לא* מוגן, בכוונה, כדי שמי שעדיין לא רשום יוכל להגיע אליו).
 *
 * שומר את קוד ההזמנה בדפדפן בכל מקרה (כדי ש-/auth יוכל לפדות אותו אחרי
 * הרשמה מוצלחת - ר' redeem_invite ב-migration 0061 + inviteService.ts),
 * ואז מנתב לפי מכשיר:
 *
 * - iOS/Android + הוגדרו NEXT_PUBLIC_IOS_APP_STORE_URL /
 *   NEXT_PUBLIC_ANDROID_PLAY_STORE_URL בסביבה -> מנותב לחנות המתאימה.
 *   ב-Android, קוד ההזמנה מצורף כ-referrer לקישור החנות - זהו הפרמטר
 *   הרשמי שה-Play Install Referrer API של גוגל מאפשר לאפליקציה הנייטיבית
 *   לקרוא אחרי ההתקנה (ר' תיעוד Google Play). ב-iOS *אין* מנגנון מקביל
 *   מובנה - App Store לא מעביר פרמטרים אחרי התקנה בלי שירות ייעודי
 *   (Branch/AppsFlyer/Universal Links+App Clips) - זו מגבלה אמיתית של
 *   הפלטפורמה, לא באג כאן, ומחכה להחלטה איזה פתרון ליישם בעתיד.
 * - כל מקרה אחר (דסקטופ, או שהחנויות עדיין לא הוגדרו) -> ממשיך בדיוק
 *   כמו היום: מסך הרשמה בווב (משתמש לא מחובר) או ישר הביתה (מחובר) -
 *   התנהגות הגישור הזו נשארת עד שייבנה עמוד web ייעודי (ר' דרישה מפורשת).
 */
export function JoinRedirect({ code }: JoinRedirectProps) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (code) storePendingInviteCode(code);
  }, [code]);

  useEffect(() => {
    if (loading) return;

    const platform = detectDevicePlatform();

    if (platform === "ios" && IOS_APP_STORE_URL) {
      window.location.replace(IOS_APP_STORE_URL);
      return;
    }

    if (platform === "android" && ANDROID_PLAY_STORE_URL) {
      const storeUrl = new URL(ANDROID_PLAY_STORE_URL);
      storeUrl.searchParams.set("referrer", `ref=${code}`);
      window.location.replace(storeUrl.toString());
      return;
    }

    if (user) {
      router.replace("/home");
    } else {
      router.replace(`/auth?ref=${encodeURIComponent(code)}`);
    }
  }, [loading, user, code, router]);

  return null;
}
