"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MapContainer, TileLayer, AttributionControl, Marker, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  IS_USING_FALLBACK_TILES,
  FALLBACK_TILE_URL,
  FALLBACK_TILE_SUBDOMAINS,
  FALLBACK_TILE_ATTRIBUTION,
  FALLBACK_TILE_MAX_ZOOM,
} from "@/constants/mapTiles";
import { MapTilerBaseLayer } from "@/components/map/MapTilerBaseLayer";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";

/** מרכז ברירת מחדל (תל אביב) - רק עד שמתקבל מיקום אמיתי מהמכשיר, או
 *  כגיבוי אם המשתמש לא אישר הרשאת מיקום. לא "דאטה מדומה" של מקומות -
 *  רק נקודת מבט התחלתית סבירה למפה, באותה רוח כמו הגיבוי הקיים ב-
 *  DiscoveryPlacesMap.tsx (computeClusterView). */
const DEFAULT_CENTER: [number, number] = [32.0853, 34.7818];
const DEFAULT_ZOOM = 13;

/** צורת מקום מוכנה להצגה כ-marker על המפה. לא נוצר/מומצא כאן שום מקור
 *  דאטה - הפרופ אופציונלי ומתחיל ריק, מוכן לחיבור עתידי (הפרומפט:
 *  "להכין אותה להצגת מקומות... אבל לא להמציא כרגע לוגיקה חדשה או
 *  נתוני דמה שאינם קיימים במערכת"). */
export interface HomeMapPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface HomeMapProps {
  places?: HomeMapPlace[];
  className?: string;
}

/** נחשף החוצה (ref) כדי שכפתור "מצפן"/מיקום-נוכחי שיושב מחוץ לרכיב
 *  הזה (ב-page.tsx, ליד כפתור ה-+ הצף) יוכל להפעיל מירכוז מחדש. */
export interface HomeMapHandle {
  recenterToUser: () => void;
}

/** אותו סגנון פין בדיוק כמו DiscoveryPlacesMap.tsx - לא ה-icon
 *  הדיפולטי של Leaflet (ששבור מחוץ לקופסה עם bundlers כמו Next.js). */
const PLACE_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
    background: var(--color-primary-start, #4F7DF3);
    border: 2px solid white; box-shadow: 0 2px 6px rgba(16,24,40,0.35);
    transform: rotate(-45deg);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const USER_LOCATION_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width: 16px; height: 16px; border-radius: 50%;
    background: #4285F4;
    border: 3px solid white; box-shadow: 0 0 0 2px rgba(66,133,244,0.35), 0 2px 6px rgba(16,24,40,0.35);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** ממרכזים בפועל את המפה כשמתקבל מיקום אמיתי (לא רק ה-center ההתחלתי
 *  של MapContainer, שלא מתעדכן מעצמו בשינוי prop). */
function RecenterOnLocation({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, DEFAULT_ZOOM, { animate: true });
  }, [center, map]);
  return null;
}

/**
 * *** תיקון (Bug - "המפה נראית שבורה/רק חלק קטן שלה נטען"): Leaflet
 * מודד את גודל ה-container שלו **פעם אחת** בזמן האתחול (getSize) ולא
 * מזהה לבד שינויי גודל מאוחרים יותר - הוא פשוט ממשיך לצייר אריחים
 * לפי המידה המקורית ההיא. אצלנו זה קורה בשני מקרים בדיוק: (1) הטעינה
 * הדינמית (dynamic import, ssr:false) לפעמים ממריאה לפני שההורה (עם
 * ה-height שמגיע מ-style חיצוני) התייצב לגמרי בפריסה, אז Leaflet
 * "תופס" מידה קטנה/שגויה כבר בהתחלה; (2) המעבר ל-Map Explore משנה את
 * גובה ה-container באנימציה (transition על height) - שינוי גודל
 * לגיטימי לגמרי אחרי שה-map כבר קיים, ש-Leaflet לא מודע אליו כלל בלי
 * שמישהו קורא ל-invalidateSize() באופן מפורש.
 *
 * הפתרון הסטנדרטי (מתועד רשמית ב-Leaflet): ResizeObserver על ה-DOM
 * element האמיתי של המפה (map.getContainer()) שקורא ל-invalidateSize()
 * בכל שינוי מידה בפועל - כולל המדידה הראשונה מיד עם ה-observe (מתקן
 * גם את (1)), וכל שינוי מאוחר יותר כתוצאה מהאנימציה (מתקן גם את (2)).
 * לא תלוי בניחוש טיימינג/setTimeout - תגובתי לגודל האמיתי בפועל.
 */
function InvalidateSizeOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/**
 * מפה אינטראקטיבית לעמוד הבית - כרטיס בגודל קבוע (לא מסך מלא, ר'
 * הערה ב-page.tsx). ממחזרת בדיוק את אותה שכבת בסיס/גיבוי כמו
 * DiscoveryPlacesMap.tsx/ResultMap.tsx (MapTilerBaseLayer + fallback
 * ל-OSM) - לא נבנתה תשתית מפות חדשה.
 *
 * חובה לייבא רכיב זה עם `dynamic(..., { ssr: false })` (כמו ש-
 * NearbySection.tsx כבר עושה ל-DiscoveryPlacesMap) - Leaflet משתמש
 * ב-window/DOM ולא ניתן לרנדור בצד השרת.
 */
export const HomeMap = forwardRef<HomeMapHandle, HomeMapProps>(function HomeMap(
  { places = [], className },
  ref
) {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  // *** ref ל-instance האמיתי של Leaflet (לא useMap - זה תקף רק
  // לרכיבים-ילדים בתוך MapContainer; כאן אנחנו צריכים לקרוא ל-setView
  // מבחוץ, מלחיצה על כפתור חיצוני). react-leaflet v4 תומך ב-ref
  // ישירות על MapContainer בדיוק לצורך זה.
  const mapInstanceRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    getCurrentPositionSafe()
      .then(({ lat, lng }) => {
        setCenter([lat, lng]);
        setUserLocation([lat, lng]);
      })
      .catch(() => {
        // אין הרשאה/כשל איתור - נשארים על ברירת המחדל, בלי שגיאה חוסמת.
      });
  }, []);

  // *** כפתור "מצפן"/מיקום-נוכחי (בקשה מפורשת - "כפתור מצפן מעל ה-+
  // שיחזיר למיקום הנוכחי שלי"): מאתר מחדש בפועל (לא רק חוזר לנקודה
  // ששמורה מהטעינה הראשונית - המשתמש יכול להיות זז מאז) ומזיז את
  // המפה + הנקודה הכחולה אליו.
  useImperativeHandle(
    ref,
    () => ({
      recenterToUser: () => {
        getCurrentPositionSafe()
          .then(({ lat, lng }) => {
            setUserLocation([lat, lng]);
            mapInstanceRef.current?.setView([lat, lng], DEFAULT_ZOOM, { animate: true });
          })
          .catch(() => {
            // אין הרשאה/כשל איתור - אין מיקום אמיתי למרכז אליו, נשארים במקום הנוכחי.
          });
      },
    }),
    []
  );

  return (
    <div
      className={`home-map-fixed-gesture ${IS_USING_FALLBACK_TILES ? "map-branded" : ""} ${className ?? ""}`}
      // *** גיבוי מפורש נוסף (מעבר ל-h-full/w-full דרך ה-className) -
      // מבטיח שה-wrapper עצמו תמיד תופס 100% מההורה שלו (שכבר קובע
      // גובה אמיתי ב-px/calc משלו ב-page.tsx), גם אם משהו בשרשרת
      // ה-Tailwind classes לא נטען כמצופה. לא סותר את ה-className.
      style={{ position: "relative", height: "100%", width: "100%" }}
    >
      <MapContainer
        ref={mapInstanceRef}
        center={center}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        zoomControl
        style={{ height: "100%", width: "100%" }}
        attributionControl={false}
      >
        <InvalidateSizeOnResize />
        <AttributionControl position="bottomright" prefix={false} />
        {IS_USING_FALLBACK_TILES ? (
          <TileLayer
            attribution={FALLBACK_TILE_ATTRIBUTION}
            url={FALLBACK_TILE_URL}
            subdomains={FALLBACK_TILE_SUBDOMAINS}
            maxZoom={FALLBACK_TILE_MAX_ZOOM}
          />
        ) : (
          <MapTilerBaseLayer />
        )}

        {places.map((place) => (
          <Marker key={place.id} position={[place.latitude, place.longitude]} icon={PLACE_ICON} />
        ))}

        {userLocation && <Marker position={userLocation} icon={USER_LOCATION_ICON} />}
        {userLocation && <RecenterOnLocation center={userLocation} />}
      </MapContainer>
    </div>
  );
});
