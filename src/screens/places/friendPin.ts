import L from "leaflet";

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
}

const WIDTH = 32;
const HEIGHT = 42;

export function getFriendPinIcon({ photoUrl, count, selected }: FriendPinOptions): L.DivIcon {
  const key = `${photoUrl ?? ""}|${count}|${selected ? 1 : 0}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const clipId = `fpc${clipCounter++}`;
  const safePhoto = photoUrl?.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const body = selected ? PURPLE_DARK : PURPLE;

  // viewBox 40x52: טיפה עם קצה בתחתית (20,51), עיגול תמונה במרכז העליון (20,20).
  const inner = safePhoto
    ? `<circle cx="20" cy="20" r="14" fill="#fff"/>
       <image href="${safePhoto}" x="7.5" y="7.5" width="25" height="25" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
    : `<circle cx="20" cy="20" r="14" fill="#fff"/><circle cx="20" cy="20" r="6" fill="${body}"/>`;

  const counter =
    count > 1
      ? `<div style="position:absolute;top:-4px;right:-6px;min-width:15px;height:15px;padding:0 4px;border-radius:8px;background:#fff;color:${PURPLE};font:800 9px/13px system-ui,sans-serif;text-align:center;border:1.5px solid ${PURPLE};box-sizing:border-box;">${count}</div>`
      : "";

  const shadow = selected
    ? "drop-shadow(0 0 6px rgba(124,58,237,0.6)) drop-shadow(0 3px 5px rgba(16,24,40,0.4))"
    : "drop-shadow(0 2px 3px rgba(16,24,40,0.38))";

  const html = `<div style="position:relative;width:${WIDTH}px;height:${HEIGHT}px;transform:${selected ? "scale(1.25)" : "scale(1)"};transform-origin:50% 100%;transition:transform .18s ease;filter:${shadow};">
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;">
      <defs><clipPath id="${clipId}"><circle cx="20" cy="20" r="12.5"/></clipPath></defs>
      <path d="M20 51C20 51 3.5 33.5 3.5 20a16.5 16.5 0 1 1 33 0C36.5 33.5 20 51 20 51Z" fill="${body}" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>
      ${inner}
    </svg>
    ${counter}
  </div>`;

  const icon = L.divIcon({ className: "", html, iconSize: [WIDTH, HEIGHT], iconAnchor: [WIDTH / 2, HEIGHT] });
  cache.set(key, icon);
  return icon;
}
