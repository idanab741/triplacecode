"use client";

import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker, Popup, AttributionControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

interface MapPlace {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

interface ValidMapPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface DiscoveryPlacesMapProps {
  places: MapPlace[];
}

/**
 * "מפה עם מיקום ונעץ של כל המקומות" (Audit - "רוצה שכל החלק היומי -
 * תהיה מפה עם מיקום ונעץ של כל המקומות... בעמוד ראה עוד"): ממחזרת את
 * אותה ספרייה/דפוס בדיוק כמו ResultMap.tsx הקיים (react-leaflet, אותו
 * ספק אריחים CARTO Voyager, אותו trick ל-FitBounds) - **לא** מנגנון
 * מפה חדש. שונה מ-ResultMap במכוון: כאן אין Polyline (קו מסלול) בין
 * התחנות ואין מספור-לפי-סדר-יום, כי אלה לא תחנות-מסלול רצופות - זו
 * רשימת "כל המקומות בקטגוריה", ללא סדר/רצף. סמן פשוט אחיד לכולם, קליק
 * פותח את דף המקום.
 */
function FitBounds({ places }: { places: ValidMapPlace[] }) {
  const map = useMap();
  useEffect(() => {
    if (places.length === 0) return;
    if (places.length === 1) {
      map.setView([places[0].latitude, places[0].longitude], 14, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(places.map((p) => [p.latitude, p.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: false });
  }, [places, map]);
  return null;
}

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

export function DiscoveryPlacesMap({ places }: DiscoveryPlacesMapProps) {
  const router = useRouter();
  const validPlaces = places.filter(
    (p): p is ValidMapPlace => p.latitude != null && p.longitude != null
  );
  if (validPlaces.length === 0) return null;

  const positions: [number, number][] = validPlaces.map((p) => [p.latitude, p.longitude]);

  return (
    <div className="relative isolate z-0 mb-5 h-56 w-full overflow-hidden rounded-card shadow-soft">
      <MapContainer center={positions[0]} zoom={12} scrollWheelZoom={false} className="h-full w-full" attributionControl={false}>
        <AttributionControl position="bottomright" prefix={false} />
        <TileLayer
          // *** תיקון Product מפורש ("מה זה הכיתוב 'API KEY REQUIRED' על
          // *** המפה??"): זו לא בעיה בקוד שלנו - זה שרת ה-tiles של CARTO
          // *** עצמו (basemaps.cartocdn.com) שהתחיל לדרוש מפתח API
          // *** לשימוש, וה-watermark הזה מגיע ישירות מהם. עברנו לשרת ה-
          // *** tiles הרשמי של OpenStreetMap עצמו - עדיין חינמי לגמרי,
          // *** בלי צורך במפתח/הרשמה כלשהי.
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        {validPlaces.map((place) => (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
            icon={PLACE_ICON}
            eventHandlers={{ click: () => router.push(`/place/${place.id}`) }}
          >
            <Popup>{place.name}</Popup>
          </Marker>
        ))}
        <FitBounds places={validPlaces} />
      </MapContainer>
    </div>
  );
}
