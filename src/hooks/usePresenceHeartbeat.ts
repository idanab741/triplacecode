"use client";

import { useEffect } from "react";

const INTERVAL_MS = 60_000;
/** מונע שליחות כפולות במעבר מהיר בין עמודים (כל עמוד מרנדר את הבר מחדש). */
let lastSentAt = 0;

function send() {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  if (Date.now() - lastSentAt < 30_000) return;
  lastSentAt = Date.now();
  fetch("/api/social/presence/heartbeat", { method: "POST", keepalive: true }).catch(() => {});
}

/**
 * *** "מחובר" אמיתי (בקשה מפורשת - ירוק/צהוב בעמוד הצ'אטים): עד עכשיו last_seen התעדכן רק
 * בכניסה לעמוד הבית או לעמוד הצ'אטים - פעם אחת. משתמש שגולש בכל עמוד אחר נראה "לא מחובר" אחרי
 * 2 דקות. עכשיו: כל עוד האפליקציה פתוחה וגלויה - עדכון כל דקה, ומיד כשחוזרים אליה.
 */
export function usePresenceHeartbeat() {
  useEffect(() => {
    send();
    const timer = setInterval(send, INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") send();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
