/**
 * הגדרות מקור המפה - משותף בין DiscoveryPlacesMap.tsx ו-ResultMap.tsx.
 *
 * *** רקע (בקשת המשתמש - "יותר מדי מקומות לא רלוונטיים" + "לוקח יותר
 * מדי זמן להיטען"): tile.openstreetmap.org (סגנון "osm-carto" הרשמי
 * של openstreetmap.org) עמוס בכוונה (מיועד למפתחי OSM לבדוק נתונים,
 * לא לאפליקציית צרכן) ומוגש משרת ממומן-תרומות בלי הסכם רמת שירות -
 * openstreetmap.org עצמו ממליץ נגד שימוש בו לאפליקציות production.
 *
 * *** תיקון: בהתחלה ניסינו URL raster רגיל (`{z}/{x}/{y}.png`) מול
 * MapTiler, כמו מול OSM - אבל הסגנון של MapTiler ("Base") הוא וקטורי,
 * לא raster PNG, אז זה לא עובד עם TileLayer רגיל. משתמשים בתוסף
 * הרשמי @maptiler/leaflet-maptilersdk (ר' MapTilerBaseLayer.tsx)
 * שנותן שכבת Leaflet ייעודית לזה.
 *
 * עד שמוגדר מפתח (NEXT_PUBLIC_MAPTILER_KEY ב-.env.local), נופלים
 * חזרה ל-OSM הרגיל (+ הטיפול הישן ב-CSS דרך מחלקת map-branded) כדי
 * שהאפליקציה לא תישבר - אבל זה fallback זמני בלבד, לא פתרון קבוע:
 * העומס בשמות ואיטיות הטעינה נשארים עד שהמפתח מוגדר בפועל.
 */
export const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

/** true כשעדיין רצים על ה-fallback הזמני (OSM) ולא על MapTiler. */
export const IS_USING_FALLBACK_TILES = !MAPTILER_KEY;

export const FALLBACK_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const FALLBACK_TILE_SUBDOMAINS = "abcd";
export const FALLBACK_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const FALLBACK_TILE_MAX_ZOOM = 19;
