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
  imageUrls?: string[] | null;
  subcategoryLabel?: string | null;
}

interface ValidMapPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  imageUrls?: string[] | null;
  subcategoryLabel?: string | null;
}

interface DiscoveryPlacesMapProps {
  places: MapPlace[];
}

/**
 * "מפה עם מיקום ונעץ של כל המקומות" (Audit - "רוצה שכל החלק היומי -
 * תהיה מפה עם מיקום ונעץ של כל המקומות... בעמוד ראה עוד"): ממחזרת את
 * אותה ספרייה/דפוס בדיוק כמו ResultMap.tsx הקיים (react-leaflet, אותו
 * ספק tiles OpenStreetMap, אותו trick ל-FitBounds) - **לא** מנגנון
 * מפה חדש. שונה מ-ResultMap במכוון: כאן אין Polyline (קו מסלול) בין
 * התחנות ואין מספור-לפי-סדר-יום, כי אלה לא תחנות-מסלול רצופות - זו
 * רשימת "כל המקומות בקטגוריה", ללא סדר/רצף.
 *
 * *** תיקון (בקשת המשתמש - "שקודם כל יהיה אפשר לראות את
 * האטרקציה/מסעדה בלחיצה... ואז אם אחליט ללחוץ שוב על הבועה אעבור
 * לעמוד"): קליק ראשון על הפין פותח בועה (Popup) עם תמונה+שם מהמאגר
 * שלנו - זו התנהגות ברירת המחדל של Leaflet, לא נדרש קוד מיוחד בשבילה.
 * הניווט לעמוד המקום (router.push) הועבר מה-Marker עצמו לתוך תוכן
 * הבועה (PlacePreview) - כך שהוא קורה רק בלחיצה שנייה, על הבועה עצמה.
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

/** תוכן הבועה עצמה: תמונה מה-DB (image_urls), שם, תת-קטגוריה אם יש,
 *  ורמז קטן שלחיצה נוספת (על התוכן, לא על הפין) מובילה לעמוד המקום. */
function PlacePreview({ place }: { place: ValidMapPlace }) {
  const router = useRouter();
  const image = place.imageUrls?.[0];

  return (
    <div
      role="button"
      onClick={() => router.push(`/place/${place.id}`)}
      className="w-32 cursor-pointer"
    >
      <div className="h-20 w-full overflow-hidden bg-bg-secondary">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={place.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg">📍</div>
        )}
      </div>
      <div className="px-1.5 py-0.5 space-y-0.5">
        <p className="line-clamp-1 text-xs font-semibold leading-none text-ink">{place.name}</p>
        {place.subcategoryLabel && (
          <p className="line-clamp-1 text-[10px] leading-none text-ink-secondary">{place.subcategoryLabel}</p>
        )}
      </div>
    </div>
  );
}

export function DiscoveryPlacesMap({ places }: DiscoveryPlacesMapProps) {
  const validPlaces = places.filter(
    (p): p is ValidMapPlace => p.latitude != null && p.longitude != null
  );
  if (validPlaces.length === 0) return null;

  const positions: [number, number][] = validPlaces.map((p) => [p.latitude, p.longitude]);

  return (
    <div className="map-branded relative isolate z-0 h-56 w-full overflow-hidden rounded-card shadow-soft">
      <MapContainer center={positions[0]} zoom={12} scrollWheelZoom={false} className="h-full w-full" attributionControl={false}>
        <AttributionControl position="bottomright" prefix={false} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        {validPlaces.map((place) => (
          <Marker key={place.id} position={[place.latitude, place.longitude]} icon={PLACE_ICON}>
            <Popup className="place-preview-popup" minWidth={128} maxWidth={128}>
              <PlacePreview place={place} />
            </Popup>
          </Marker>
        ))}
        <FitBounds places={validPlaces} />
      </MapContainer>
      {/* *** תוספת (בקשה מפורשת - "כחול תכלת - אפור - לבן"): שכבת גוון
          שקופה בצבע המותג מעל אריחי המפה (שהופכו ל-grayscale למטה ב-
          globals.css), עם mix-blend-mode:color. זו הטכניקה הנכונה
          ל"דו-גוני" אמיתי - היא לוקחת רק את הגוון+הרוויה מהשכבה הזו,
          אבל שומרת על הבהירות המקורית של כל אריח (ים כהה יותר, יבשה
          בהירה יותר) - כך מתקבל בפועל טווח אמיתי של כחול-תכלת/אפור/
          לבן, לא צבע כחול אחיד שטוח. pointer-events-none כדי לא לחסום
          קליקים על הפינים/זום שמתחת. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[350] mix-blend-color bg-primary-start/40" />
    </div>
  );
}
