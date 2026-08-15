"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// המפה (Leaflet) משתמשת ב-window/DOM - חייבת להיטען רק בצד הלקוח, לא ב-SSR
const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), {
  ssr: false,
});

interface PlaceNavigationCardProps {
  placeId: string;
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;
const AVERAGE_CITY_DRIVING_KMH = 35; // הערכה גסה לצורך "זמן הגעה משוער" בלבד
const MAX_REASONABLE_DRIVING_KM = 400; // מעבר לזה, "זמן נסיעה ברכב" כבר לא הגיוני (דורש טיסה)

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** מציג ביחידה המתאימה בפועל - דקות / שעות / ימים - במקום מספר דקות גולמי
 *  שיכול להגיע לעשרות אלפים כשמדובר במרחק בין-יבשתי. */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} שעות`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "יום" : "ימים"}`;
}

/** כרטיס "זמן הגעה" + תצוגה מקדימה של מפה + כפתור "התחל ניווט" - פותח
 *  את אפליקציית המפות של המשתמש (לא ניווט מלא בתוך האפליקציה - זה הדפוס
 *  הסטנדרטי גם באפליקציות מבוססות-מיקום אחרות). זמן ההגעה הוא הערכה
 *  גסה (קו אווירי חלקי ממוצע נסיעה עירונית), לא תוצאה מ-Directions API. */
export function PlaceNavigationCard({ placeId, latitude, longitude }: PlaceNavigationCardProps) {
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const km = haversineKm(pos.coords.latitude, pos.coords.longitude, latitude, longitude);
        setDistanceKm(km);
        setEtaMinutes(Math.max(1, Math.round((km / AVERAGE_CITY_DRIVING_KMH) * 60)));
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
          {distanceKm == null ? (
            <>
              <span className="text-lg">🚗</span>
              <span className="text-sm font-semibold text-ink">מחשב זמן הגעה...</span>
            </>
          ) : distanceKm <= MAX_REASONABLE_DRIVING_KM ? (
            <>
              <span className="text-lg">🚗</span>
              <span className="text-sm font-semibold text-ink">{formatDuration(etaMinutes!)} מהמיקום שלך (משוער)</span>
            </>
          ) : (
            <>
              <span className="text-lg">📍</span>
              <span className="text-sm font-semibold text-ink">
                {Math.round(distanceKm).toLocaleString()} ק&quot;מ מהמיקום שלך - מרחק שדורש טיסה
              </span>
            </>
          )}
        </div>
      )}

      {/* *** תיקון: זו הייתה תמונת Google Static Maps (קריאת רשת ל-Google
          בכל טעינת עמוד) - עברנו למפת Leaflet משלנו (ResultMap, אותה
          שכבר בשימוש בכל שאר האפליקציה), עם סמן בודד. בלי שום קריאה
          ל-Google בכלל. */}
      <ResultMap stops={[{ stopId: placeId, name: "", latitude, longitude }]} />

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
