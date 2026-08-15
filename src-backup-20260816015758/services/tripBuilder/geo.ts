import type { LatLng, DistanceBand } from "./types";

const EARTH_RADIUS_KM = 6371;
const WALK_KMH = 4.5;
const DRIVE_KMH = 32;

/** מרחק קו-ישר בין שתי נקודות (נוסחת Haversine), בק"מ. */
export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** הערכה גסה (קו ישר, לא ניתוב אמיתי) של זמן נסיעה בדקות. */
export function estimateTravelMinutes(distanceKm: number, mode: "walk" | "drive"): number {
  const speedKmh = mode === "walk" ? WALK_KMH : DRIVE_KMH;
  return Math.max(1, Math.round((distanceKm / speedKmh) * 60));
}

const DISTANCE_BAND_MAX_MINUTES: Record<DistanceBand, number> = {
  "10min": 10,
  "20min": 20,
  "30min": 30,
  "40min": 40,
  "50min": 50,
  "1h": 60,
  "1.5h": 90,
  "2h": 120,
  "2.5h": 150,
  "3h": 180,
  "4h": 240,
  "5h": 300,
};

/** ממיר בחירת "מרחק מקסימלי" (בדקות נסיעה) לרדיוס בק"מ, לפי מהירות נסיעה ברכב. */
export function distanceBandToRadiusKm(band: DistanceBand): number {
  const maxMinutes = DISTANCE_BAND_MAX_MINUTES[band];
  return (maxMinutes / 60) * DRIVE_KMH;
}

/** ממיר רדיוס בק"מ להפרש מעלות גס (לצורך bounding-box pre-filter בשאילתה). */
export function kmToDegreesLat(km: number): number {
  return km / 111;
}

export function kmToDegreesLng(km: number, atLat: number): number {
  const kmPerDegree = 111 * Math.cos(toRad(atLat));
  return kmPerDegree === 0 ? km / 111 : km / kmPerDegree;
}
