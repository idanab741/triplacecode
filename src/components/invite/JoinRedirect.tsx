"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { storePendingInviteCode } from "@/services/invite/inviteService";
import { detectDevicePlatform } from "@/utils/detectDevicePlatform";
import { ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL } from "@/constants/appStoreLinks";

interface JoinRedirectProps {
  code: string;
}

/**
 * צד ה"קליטה" של לינק ההזמנה - /join/<code>. זו נקודת הכניסה הציבורית
 * שכל חבר שמקבל לינק הזמנה מגיע אליה בפועל (ר' proxy.ts - הנתיב הזה
 * *לא* מוגן, בכוונה, כדי שמי שעדיין לא רשום יוכל להגיע אליו).
 *
 * שומר את קוד ההזמנה בדפדפן בכל מקרה (כדי ש-/auth יוכל לפדות אותו אחרי
 * הרשמה מוצלחת - ר' redeem_invite ב-migration 0061 + inviteService.ts),
 * ואז מנתב לפי מכשיר:
 *
 * - iOS -> App Store (ר' constants/appStoreLinks.ts - הקישור האמיתי
 *   שסופק, id6757530943).
 * - Android -> Google Play (com.triplacetravel.app), עם קוד ההזמנה
 *   מצורף כ-referrer - זהו הפרמטר הרשמי שה-Play Install Referrer API של
 *   גוגל מאפשר לאפליקציה הנייטיבית לקרוא אחרי ההתקנה (ר' תיעוד Google
 *   Play). ב-iOS *אין* מנגנון מקביל מובנה - App Store לא מעביר פרמטרים
 *   אחרי התקנה בלי שירות ייעודי (Branch/AppsFlyer/Universal Links+App
 *   Clips) - זו מגבלה אמיתית של הפלטפורמה, לא באג כאן.
 * - כל מקרה אחר (דסקטופ) -> ממשיך בדיוק כמו היום: מסך הרשמה בווב
 *   (משתמש לא מחובר) או ישר הביתה (מחובר) - עד שייבנה עמוד web ייעודי
 *   (ר' דרישה מפורשת).
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

    if (platform === "ios") {
      window.location.replace(IOS_APP_STORE_URL);
      return;
    }

    if (platform === "android") {
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
