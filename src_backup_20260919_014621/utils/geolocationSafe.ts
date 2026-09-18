/** עוטף בקשת מיקום - עם זיהוי אוטומטי אם האתר רץ בתוך אפליקציית Natively
 *  (השירות שעוטף את הלינק שלנו לאפליקציה) - כי Natively חושפת API משלה
 *  ל-JS (window.NativelyLocation), נפרד לגמרי מ-navigator.geolocation
 *  הרגיל של הדפדפן. זו הסיבה המדויקת לכך שבקשת מיקום בתוך האפליקציה
 *  הייתה תקועה לנצח בלי שום callback - קראנו רק ל-API הסטנדרטי, שלא
 *  מחובר בפועל להרשאות המכשיר בתוך ה-WebView של Natively.
 *  מקור: https://docs.buildnatively.com/guides/integration/geolocation
 *
 *  אם window.NativelyLocation קיים (כלומר רצים בתוך אפליקציית Natively) -
 *  משתמשים ב-API שלהם. אחרת (דפדפן רגיל) - נופלים ל-navigator.geolocation
 *  הסטנדרטי, כמו קודם. בנוסף, תמיד יש timeout ידני משלנו כרשת ביטחון,
 *  למקרה שגם ה-API הזה לא יקרא ל-callback מסיבה כלשהי. */

declare global {
  interface Window {
    NativelyLocation?: new () => {
      current: (
        minAccuracy: number,
        accuracyType: string,
        priorityAndroid: string,
        callback: (resp: { status: string; longitude?: number; latitude?: number }) => void,
        fallbackToSettings: boolean
      ) => void;
    };
  }
}

const MANUAL_TIMEOUT_MS = 10000;

export function getCurrentPositionSafe(
  errorMessage = "לא הצלחנו לאתר את המיקום שלך - יש לאשר גישה למיקום ולנסות שוב"
): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const manualTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(errorMessage));
    }, MANUAL_TIMEOUT_MS);

    function succeed(lat: number, lng: number) {
      if (settled) return;
      settled = true;
      clearTimeout(manualTimeout);
      resolve({ lat, lng });
    }

    function fail() {
      if (settled) return;
      settled = true;
      clearTimeout(manualTimeout);
      reject(new Error(errorMessage));
    }

    // *** בתוך אפליקציית Natively - השתמשו ב-API הייעודי שלהם, לא בדפדפן
    // הסטנדרטי. fallback_to_settings=true פותח למשתמש פופאפ ישיר להגדרות
    // האפליקציה אם ההרשאה נדחתה, במקום פשוט להיכשל בלי הסבר.
    if (typeof window !== "undefined" && window.NativelyLocation) {
      try {
        const locationService = new window.NativelyLocation();
        locationService.current(50, "Best", "BALANCED", (resp) => {
          if (resp.status === "Error" || resp.latitude == null || resp.longitude == null) {
            fail();
          } else {
            succeed(resp.latitude, resp.longitude);
          }
        }, true);
      } catch {
        fail();
      }
      return;
    }

    // דפדפן רגיל (לא בתוך אפליקציית Natively) - navigator.geolocation הסטנדרטי.
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      settled = true;
      clearTimeout(manualTimeout);
      reject(new Error("הדפדפן שלך לא תומך באיתור מיקום"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => succeed(position.coords.latitude, position.coords.longitude),
      () => fail(),
      { enableHighAccuracy: false, timeout: MANUAL_TIMEOUT_MS }
    );
  });
}
