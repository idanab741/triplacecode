"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/ui/Icon";

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

  // *** תוספת (בקשה מפורשת - "אפשר לעשות ניווט ב-Waze, יש לנו את
  // האייקון מאפס"): אותה נוסחת קישור בדיוק כמו ב-HomeMapPlacePopupContent.tsx/
  // PlaceMapPopupCard.tsx - לא ממציאים פורמט חדש. משותף (לא רק ל-
  // TripAdd) כי כל מקום עם lat/lng נהנה מזה באותה מידה.
  function handleStartWaze() {
    window.open(`https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`, "_blank");
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

      {/* *** תיקון (בקשה מפורשת - "אייקונים של וויז וגוגל מאפס"): שני
          כפתורי ניווט זה לצד זה במקום כפתור גנרי בודד - בדיוק אותם
          שני האייקונים הקיימים כבר בחלונית המפה (PlaceMapPopupCard). */}
      {/* *** תיקון (בקשה מפורשת - "שני הכפתורים אותו צבע, עדיף לא
          כחול"): קודם Google Maps היה גרדיאנט כחול ו-Waze לבן - שני
          סגנונות שונים גרמו לזה להיראות כאילו אחד "עיקרי" והשני
          "משני", בלי שהייתה כוונה כזו. עכשיו שניהם באותו סגנון ניטרלי
          בדיוק (רקע אפור בהיר, טקסט כהה) - ההבחנה היחידה בין השתיים
          היא האייקון הצבעוני של כל שירות, לא צבע הרקע של הכפתור. */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleStartNavigation}
          className="h-12 rounded-xl text-[15.5px] font-semibold flex flex-1 items-center justify-center gap-2 bg-bg-secondary text-ink"
        >
          <Icon name="google-maps" size={22} />
          Google Maps
        </button>
        <button
          type="button"
          onClick={handleStartWaze}
          className="h-12 rounded-xl text-[15.5px] font-semibold flex flex-1 items-center justify-center gap-2 bg-bg-secondary text-ink"
        >
          <Icon name="waze" size={26} />
          Waze
        </button>
      </div>
    </div>
  );
}
