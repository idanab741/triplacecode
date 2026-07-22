import type { FinalItineraryStop, LatLng } from "./types";

/** מרחק קו-ישר בקילומטרים, זהה לחישוב שכבר יש בשרת (geo.ts) - כדי לחשב מחדש בצד הלקוח בלי קריאת שרת. */
function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function estimateTravelMinutes(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / 32) * 60)); // 32 קמ"ש - זהה לערך בשרת
}

/**
 * מחשב מחדש את זמני ההגעה לכל תחנה, לפי סדר חדש שהמשתמש קבע בגרירה -
 * בלי לפנות לשרת, כדי שהתצוגה תתעדכן מיד בלי המתנה.
 */
export function recalculateStopTimes(
  stops: FinalItineraryStop[],
  origin: LatLng
): FinalItineraryStop[] {
  let cursor = origin;
  let cumulativeMinutes = 0;

  return stops.map((stop) => {
    const distanceKm = haversineDistanceKm(cursor, { lat: stop.latitude, lng: stop.longitude });
    const etaMinutes = estimateTravelMinutes(distanceKm);
    cumulativeMinutes += etaMinutes;

    const updated: FinalItineraryStop = {
      ...stop,
      etaMinutes,
      arrivalOffsetMinutes: cumulativeMinutes,
    };

    cumulativeMinutes += stop.estimatedVisitMinutes ?? 60;
    cursor = { lat: stop.latitude, lng: stop.longitude };

    return updated;
  });
}