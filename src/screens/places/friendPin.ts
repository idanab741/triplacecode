import L from "leaflet";
import { optimizeImage } from "@/utils/imageUrl";

/**
 * נעץ למפת place's: טיפה סגולה קטנה עם עיגול-תמונת המקום בפנים.
 *
 * *** עיצוב מחדש (בקשה מפורשת - "האייקונים גדולים מדי, צריכים להיות יותר חדים ואיכותיים,
 * ולא צריך את העיגול של האדם מעל"):
 *  - קטן יותר (32x42 במקום 46x46 מסובב), בלי תגית האווטאר (האדם) - המידע על מי המליץ
 *    נמצא בכרטיס למטה ובעמוד המקום.
 *  - חד: הנעץ צויר קודם כ-div מסובב 45° עם תמונת רקע שמסובבת בחזרה - שתי סיבובים של
 *    bitmap = דגימה חוזרת ומריחה. עכשיו זה SVG וקטורי: הטיפה וטבעת התמונה חדות בכל
 *    רזולוציה, והתמונה נמתחת פעם אחת בלבד (ללא סיבוב) בעיגול חיתוך.
 * הנעץ הנבחר מוגדל עם הילה. ה-cache לפי כל הפרמטרים; לכל אייקון מזהה clipPath ייחודי.
 */
const cache = new Map<string, L.DivIcon>();
let clipCounter = 0;

const PURPLE = "#7C3AED";
const PURPLE_DARK = "#5B21B6";

interface FriendPinOptions {
  photoUrl: string | null;
  /** כמה אנשים המליצו על המקום - מוצג כמונה קטן רק כשיש יותר מאחד. */
  count: number;
  selected: boolean;
  /** בחירה מרובה (אוסף/מסלול חדש): מסגרת סגולה + וי בפינה. */
  checked?: boolean;
}

const WIDTH = 40;
const HEIGHT = 48;

/**
 * *** עיצוב מחדש (בקשה מפורשת - "המפה נראית חיוורת ומרושלת"): הטיפה הסגולה המלאה הוחלפה
 * בבועת תמונה עגולה - התמונה היא הגיבור (כמו בנעצי תמונות של Apple Maps / Airbnb):
 *  - רגיל: עיגול תמונה 36px עם מסגרת לבנה עבה + זנב קטן לבן שמצביע על הנקודה.
 *  - נבחר: המסגרת והזנב הופכים סגולים, והנעץ מוגדל - ברור מיד מה נבחר.
 *  - צל אחד צמוד וחד (לא הילה מטושטשת), כדי שהנעץ "יישב" על המפה ולא ירחף.
 *  - מונה ממליצים: עיגול סגול מלא עם מספר לבן, בפינה העליונה.
 */
export function getFriendPinIcon({ photoUrl, count, selected, checked = false }: FriendPinOptions): L.DivIcon {
  const key = `v2|${photoUrl ?? ""}|${count}|${selected ? 1 : 0}|${checked ? 1 : 0}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const clipId = `fpc${clipCounter++}`;
  // *** ביצועים: הנעץ מציג עיגול של 31px - מורידים תמונה בגודל הזה, לא את קובץ המקור (כמה MB לכל נעץ).
  const safePhoto = (photoUrl ? optimizeImage(photoUrl, 36, { height: 36 }) : null)?.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const frame = selected || checked ? PURPLE : "#FFFFFF";

  // viewBox 40x48: עיגול במרכז (20,19) ברדיוס 18, זנב עד (20,47).
  const inner = safePhoto
    ? `<image href="${safePhoto}" x="4.5" y="3.5" width="31" height="31" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
    : `<circle cx="20" cy="19" r="15.5" fill="#F3EEFF"/><circle cx="20" cy="19" r="5" fill="${PURPLE}"/>`;

  const check = checked
    ? `<div style="position:absolute;top:-4px;right:-4px;width:20px;height:20px;border-radius:10px;background:${PURPLE};box-shadow:0 0 0 2px #fff;display:flex;align-items:center;justify-content:center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>`
    : "";

  const counter =
    count > 1
      ? `<div style="position:absolute;top:-3px;left:-3px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:${PURPLE_DARK};color:#fff;font:700 10.5px/18px var(--font-sans),system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff;box-sizing:border-box;">${count}</div>`
      : "";

  const html = `<div style="position:relative;width:${WIDTH}px;height:${HEIGHT}px;transform:scale(${selected ? 1.18 : 1});transform-origin:50% 100%;transition:transform .2s cubic-bezier(.22,1,.36,1);filter:drop-shadow(0 1px 1.5px rgba(15,20,25,.28)) drop-shadow(0 4px 8px rgba(15,20,25,.14));">
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;">
      <defs><clipPath id="${clipId}"><circle cx="20" cy="19" r="15.5"/></clipPath></defs>
      <path d="M14.5 34.2 20 46.5l5.5-12.3Z" fill="${frame}"/>
      <circle cx="20" cy="19" r="18.2" fill="${frame}"/>
      ${inner}
    </svg>
    ${counter}
    ${check}
  </div>`;

  const icon = L.divIcon({ className: "", html, iconSize: [WIDTH, HEIGHT], iconAnchor: [WIDTH / 2, HEIGHT - 1] });
  cache.set(key, icon);
  return icon;
}
