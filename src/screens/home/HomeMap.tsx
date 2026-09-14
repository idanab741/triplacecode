"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, AttributionControl, Marker, useMap } from "react-leaflet";
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
 * מפה אינטראקטיבית גדולה לעמוד הבית (סעיף 2+5 בפרומפט - "לא תמונת
 * רקע", "להשתמש בתשתית המפות שכבר קיימת ולא ליצור מערכת מפות חדשה
 * במקביל"). ממחזרת בדיוק את אותה שכבת בסיס/גיבוי כמו
 * DiscoveryPlacesMap.tsx ו-ResultMap.tsx (MapTilerBaseLayer + fallback
 * ל-OSM), רק בפריסה מלאה (h-full/w-full דרך ה-container שמגדיר את
 * הגובה מבחוץ) ועם zoom/scroll פעילים - כאן המפה היא חוויית המסך
 * המרכזית, לא כרטיס קטן בתוך עמוד.
 *
 * חובה לייבא רכיב זה עם `dynamic(..., { ssr: false })` (כמו ש-
 * NearbySection.tsx כבר עושה ל-DiscoveryPlacesMap) - Leaflet משתמש
 * ב-window/DOM ולא ניתן לרנדור בצד השרת.
 */
export function HomeMap({ places = [], className }: HomeMapProps) {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

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

  return (
    <div className={`${IS_USING_FALLBACK_TILES ? "map-branded" : ""} ${className ?? ""}`}>
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        zoomControl
        className="h-full w-full"
        attributionControl={false}
      >
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
}
