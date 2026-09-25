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
  /** יוצר תוכן מאומת שהעלה את המקום - עיגול קטן עם התמונה שלו ליד הנעץ */
  creatorAvatarUrl?: string | null;
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
export function getFriendPinIcon({ photoUrl, count, selected, checked = false, creatorAvatarUrl = null }: FriendPinOptions): L.DivIcon {
  return getPhotoPinIcon({ photoUrl, count, selected, checked, creatorAvatarUrl });
}

export interface PhotoPinOptions {
  photoUrl: string | null;
  selected: boolean;
  /** צבע המסגרת כשנבחר / מסומן (ברירת מחדל: הסגול של place's) */
  accent?: string;
  /** מונה ממליצים (מפת place's) - מוצג רק כשגדול מ-1 */
  count?: number;
  /** בחירה מרובה - וי בפינה */
  checked?: boolean;
  /** תווית בפינה (למשל מספר התחנה במסלול) בצבע badgeColor */
  badge?: string;
  badgeColor?: string;
  /** שם שמוצג מעל הנעץ כשהוא נבחר */
  label?: string;
  /** *** בקשה מפורשת ("יוצרי תוכן שמעלים מקומות - עם העיגול הקטן של הפרופיל שלהם ליד הנעץ"):
   *  תמונת הפרופיל של היוצר המאומת, בעיגול קטן בפינה העליונה של הנעץ. */
  creatorAvatarUrl?: string | null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** *** בקשה מפורשת ("המפה צריכה להיות זהה למפה שלנו ב-places, עם אותם פינים"): הנעץ של מפת place's,
 *  משותף לכל המפות - מפת place's, עמוד טיול ועמוד אוסף. */
export function getPhotoPinIcon({
  photoUrl,
  selected,
  accent = PURPLE,
  count = 0,
  checked = false,
  badge,
  badgeColor = PURPLE_DARK,
  label,
  creatorAvatarUrl = null,
}: PhotoPinOptions): L.DivIcon {
  const key = `v3|${photoUrl ?? ""}|${count}|${selected ? 1 : 0}|${checked ? 1 : 0}|${accent}|${badge ?? ""}|${badgeColor}|${selected ? label ?? "" : ""}|${creatorAvatarUrl ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const clipId = `fpc${clipCounter++}`;
  // *** ביצועים: הנעץ מציג עיגול של 31px - מורידים תמונה בגודל הזה, לא את קובץ המקור (כמה MB לכל נעץ).
  const safePhoto = (photoUrl ? optimizeImage(photoUrl, 36, { height: 36 }) : null)?.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const frame = selected || checked ? accent : "#FFFFFF";

  // viewBox 40x48: עיגול במרכז (20,19) ברדיוס 18, זנב עד (20,47).
  const inner = safePhoto
    ? `<image href="${safePhoto}" x="4.5" y="3.5" width="31" height="31" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
    : `<circle cx="20" cy="19" r="15.5" fill="#F3EEFF"/><circle cx="20" cy="19" r="5" fill="${accent}"/>`;

  const corner = (content: string, bg: string, side: "left" | "right") =>
    `<div style="position:absolute;top:-3px;${side}:-3px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:${bg};color:#fff;font:700 10.5px/18px var(--font-sans),system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">${content}</div>`;

  const counter = count > 1 ? corner(String(count), PURPLE_DARK, "left") : "";
  const badgeHtml = badge ? corner(escapeHtml(badge), badgeColor, "left") : "";
  const check = checked
    ? corner(`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`, accent, "right")
    : "";
  const safeAvatar = creatorAvatarUrl?.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  // היוצר המאומת - בפינה העליונה-ימנית (כשהנעץ מסומן בבחירה מרובה - הוי תופס את הפינה הזו)
  const avatarHtml =
    safeAvatar && !checked
      ? `<div style="position:absolute;top:-6px;right:-7px;width:21px;height:21px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 2px #fff,0 2px 5px rgba(15,20,25,.3);background:#EFF1F4;"><img src="${safeAvatar}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/></div>`
      : "";
  const labelHtml =
    selected && label
      ? `<div style="position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;padding:6px 12px;border-radius:999px;background:#fff;color:#0f1419;font:600 13px/1.2 var(--font-sans),system-ui,sans-serif;box-shadow:0 6px 18px -6px rgba(15,20,25,.35);direction:rtl">${escapeHtml(label)}</div>`
      : "";

  const html = `<div style="position:relative;width:${WIDTH}px;height:${HEIGHT}px;transform:scale(${selected ? 1.18 : 1});transform-origin:50% 100%;transition:transform .2s cubic-bezier(.22,1,.36,1);filter:drop-shadow(0 1px 1.5px rgba(15,20,25,.28)) drop-shadow(0 4px 8px rgba(15,20,25,.14));">
    ${labelHtml}
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;">
      <defs><clipPath id="${clipId}"><circle cx="20" cy="19" r="15.5"/></clipPath></defs>
      <path d="M14.5 34.2 20 46.5l5.5-12.3Z" fill="${frame}"/>
      <circle cx="20" cy="19" r="18.2" fill="${frame}"/>
      ${inner}
    </svg>
    ${counter}
    ${badgeHtml}
    ${avatarHtml}
    ${check}
  </div>`;

  const icon = L.divIcon({ className: "", html, iconSize: [WIDTH, HEIGHT], iconAnchor: [WIDTH / 2, HEIGHT - 1] });
  cache.set(key, icon);
  return icon;
}
