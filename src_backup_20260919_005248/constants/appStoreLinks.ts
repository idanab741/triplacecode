/**
 * קישורי החנויות האמיתיים של TRIPLACE. ברירת המחדל היא הקישור האמיתי
 * שסופק בפועל (לא placeholder) - ניתן לדרוס אותו דרך משתני סביבה
 * (NEXT_PUBLIC_IOS_APP_STORE_URL / NEXT_PUBLIC_ANDROID_PLAY_STORE_URL)
 * למשל לצורך סביבת staging עם אפליקציה אחרת, בלי לגעת בקוד.
 */
export const IOS_APP_STORE_URL =
  process.env.NEXT_PUBLIC_IOS_APP_STORE_URL ?? "https://apps.apple.com/il/app/triplace/id6757530943";

export const ANDROID_PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL ??
  "https://play.google.com/store/apps/details?id=com.triplacetravel.app&hl=he";
