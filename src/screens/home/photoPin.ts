import L from "leaflet";

/**
 * נעץ-טיפה עם עיגול-תמונה בפנים - אותו עיצוב בדיוק כמו "הנעצים החדשים" של
 * מפת עמוד הבית (getPlaceIcon ב-HomeMap.tsx): נעץ 38px בצבע הקטגוריה, עם
 * תמונת המקום בעיגול 32px (מסובבת בחזרה +45deg כדי שתיראה זקופה). בלי תמונה -
 * נעץ צבעוני פשוט (28px), בלי להמציא תמונה שאין.
 * מפתח ה-cache כולל את ה-URL - כל נעץ עם תמונה אחרת הוא אייקון שונה.
 */
const cache = new Map<string, L.DivIcon>();

/** color: כל צבע CSS תקין (למשל "#6A39C1" או "var(--color-category-green)"). */
export function getPhotoPinIcon(color: string, photoUrl?: string | null): L.DivIcon {
  const cacheKey = `${color}|${photoUrl ?? ""}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const safePhotoUrl = photoUrl?.replace(/['"]/g, "");

  const html = safePhotoUrl
    ? `<div style="
        width: 38px; height: 38px; border-radius: 50% 50% 50% 0;
        background: ${color};
        border: 2px solid white; box-shadow: 0 2px 8px rgba(16,24,40,0.4);
        transform: rotate(-45deg);
        display: flex; align-items: center; justify-content: center;
      "><div style="
        width: 32px; height: 32px; border-radius: 50%;
        background-image: url('${safePhotoUrl}'); background-size: cover; background-position: center;
        transform: rotate(45deg);
      "></div></div>`
    : `<div style="
        width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
        background: ${color};
        border: 2px solid white; box-shadow: 0 2px 6px rgba(16,24,40,0.35);
        transform: rotate(-45deg);
      "></div>`;

  const icon = L.divIcon({
    className: "",
    html,
    iconSize: safePhotoUrl ? [38, 38] : [28, 28],
    iconAnchor: safePhotoUrl ? [19, 38] : [14, 28],
  });
  cache.set(cacheKey, icon);
  return icon;
}
