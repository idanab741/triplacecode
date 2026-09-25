/** טיפוסים ועזרים של מפות הטיול/האוסף - בלי Leaflet, כדי שאפשר לייבא אותם גם בשרת (SSR).
 *  הרכיב עצמו (JourneyMap) נטען רק בדפדפן (dynamic, ssr:false). */

export interface JourneyMarker {
  id: string;
  latitude: number;
  longitude: number;
  /** השם - לתווית של הנעץ הנבחר ולקוראי מסך. */
  name: string;
  /** נעץ ממוספר: הטקסט שבתוכו ("1", "2"...). */
  label?: string;
  /** נעץ תמונה: כתובת התמונה (עדיפות על label). */
  imageUrl?: string | null;
  /** צבע הנעץ הממוספר / הטבעת של נעץ התמונה. */
  color: string;
}

export interface JourneyLine {
  id: string;
  points: { latitude: number; longitude: number }[];
  color: string;
  dashed?: boolean;
}

export const JOURNEY_COLORS = ["#0A6DFE", "#E0701A", "#0F766E", "#7C3AED", "#BE185D", "#1E3A5F", "#B45309", "#0891B2"];

export function journeyColor(index: number): string {
  return JOURNEY_COLORS[((index % JOURNEY_COLORS.length) + JOURNEY_COLORS.length) % JOURNEY_COLORS.length];
}

/** קישור ניווט של Google Maps: יעד אחד, או מסלול עם עד 9 עצירות בדרך (מגבלת Google). */
export function directionsUrl(points: { latitude: number; longitude: number }[]): string | null {
  if (points.length === 0) return null;
  const fmt = (p: { latitude: number; longitude: number }) => `${p.latitude},${p.longitude}`;
  const destination = points[points.length - 1];
  const waypoints = points.slice(0, -1).slice(0, 9);
  const params = new URLSearchParams({ api: "1", destination: fmt(destination) });
  if (waypoints.length > 0) params.set("waypoints", waypoints.map(fmt).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
