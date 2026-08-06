"use client";

import { useEffect, useState } from "react";

interface PlaceNavigationCardProps {
  placeId: string;
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;
const AVERAGE_CITY_DRIVING_KMH = 35; // הערכה גסה לצורך "זמן הגעה משוער" בלבד

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** כרטיס "זמן הגעה" + תצוגה מקדימה של מפה + כפתור "התחל ניווט" - פותח
 *  את אפליקציית המפות של המשתמש (לא ניווט מלא בתוך האפליקציה - זה הדפוס
 *  הסטנדרטי גם באפליקציות מבוססות-מיקום אחרות). זמן ההגעה הוא הערכה
 *  גסה (קו אווירי חלקי ממוצע נסיעה עירונית), לא תוצאה מ-Directions API. */
export function PlaceNavigationCard({ placeId, latitude, longitude }: PlaceNavigationCardProps) {
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const distanceKm = haversineKm(pos.coords.latitude, pos.coords.longitude, latitude, longitude);
        setEtaMinutes(Math.max(1, Math.round((distanceKm / AVERAGE_CITY_DRIVING_KMH) * 60)));
      },
      () => setLocationDenied(true),
      { timeout: 8000 }
    );
  }, [latitude, longitude]);

  function handleStartNavigation() {
    // בלי origin - Google Maps ישתמש אוטומטית במיקום הנוכחי של המשתמש
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`, "_blank");
  }

  return (
    <div className="flex flex-col gap-3">
      {!locationDenied && (
        <div className="flex items-center gap-2 rounded-card bg-bg-secondary px-4 py-3">
          <span className="text-lg">🚗</span>
          <span className="text-sm font-semibold text-ink">
            {etaMinutes != null ? `${etaMinutes} דקות מהמיקום שלך (משוער)` : "מחשב זמן הגעה..."}
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-card bg-bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/places/${placeId}/map-preview`} alt="מפה" className="h-40 w-full object-cover" loading="lazy" />
      </div>

      <button
        type="button"
        onClick={handleStartNavigation}
        className="w-full rounded-pill py-4 text-base font-bold text-white shadow-soft"
        style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
      >
        התחל ניווט
      </button>
    </div>
  );
}
