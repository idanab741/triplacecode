/**
 * זיהוי מכשיר בסיסי לצורך ניתוב לחנות האפליקציה הנכונה (ר' JoinRedirect.tsx).
 * מבוסס על navigator.userAgent - השיטה הסטנדרטית והנפוצה ביותר לזיהוי
 * כזה בצד לקוח, ללא ספרייה חיצונית. לא 100% חסין (UA אפשר לזייף), אבל
 * מספיק אמין להחלטת ניתוב לא-קריטית כמו זו.
 */
export type DevicePlatform = "ios" | "android" | "other";

export function detectDevicePlatform(): DevicePlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";

  // iPadOS 13+ מזהה את עצמו כ-Macintosh עם תמיכה במגע - ללא הבדיקה
  // הזו, אייפדים היו מסווגים בטעות כמחשב שולחני.
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";

  if (/Android/.test(ua)) return "android";

  return "other";
}
