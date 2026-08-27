"use client";

import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker, Popup, AttributionControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { IS_USING_FALLBACK_TILES, FALLBACK_TILE_URL, FALLBACK_TILE_SUBDOMAINS, FALLBACK_TILE_ATTRIBUTION, FALLBACK_TILE_MAX_ZOOM } from "@/constants/mapTiles";
import { MapTilerBaseLayer } from "@/components/map/MapTilerBaseLayer";
import { getCategoryLabel } from "@/utils/categoryLabels";

interface MapPlace {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  imageUrls?: string[] | null;
  /** תיקון (בקשה מפורשת - "כל האטרקציות/מסעדות/אתרים... על בסיס מסך
   *  התגיות... לא שום דבר אחר!!"): category (נערך במסך התגיות, "קטגוריה
   *  ראשית") במקום subcategory (שדה טקסט חופשי נפרד, יכול "להיתקע"
   *  עם ערך ישן - ר' src/app/place/[id]/page.tsx להסבר המלא). מוצג
   *  מתורגם בקומפוננטה עצמה, לא כאן - ר' PlacePreview למטה.
   */
  category?: string | null;
}

interface ValidMapPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  imageUrls?: string[] | null;
  category?: string | null;
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
      map.setView([places[0].latitude, places[0].longitude], 13, { animate: false });
      return;
    }

    // *** תיקון (בקשת המשתמש - "המפה צריכה להיות איפה שיש את כל
    // הדקירות!!"): שני הניסיונות הקודמים (מרכז גיאומטרי / פין בודד
    // הכי קרוב למרכז) לא באמת פתרו את הבעיה - שניהם התמקדו בנקודה
    // *אחת*, בלי שום ערבות שרוב הפינים בכלל נראים סביבה. הפתרון הנכון:
    // איתור האשכול הצפוף בפועל (לא נקודה תיאורטית) - לכל מקום סופרים
    // כמה מקומות אחרים נמצאים בטווח סביר ממנו (15 ק"מ), בוחרים את
    // המקום עם הכי הרבה "שכנים" כמוקד האשכול, ואז מציירים את הגבולות
    // (fitBounds) רק סביב האשכול הזה - לא סביב כל הפינים. פינים בודדים
    // רחוקים (outliers) נשארים מחוץ לתצוגה בכוונה, כי הם אלה שגרמו
    // למפה להתרחק/להתמקד באמצע ריק.
    const RADIUS_KM = 15;
    function distanceKm(a: ValidMapPlace, b: ValidMapPlace): number {
      const R = 6371;
      const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
      const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
      const lat1 = (a.latitude * Math.PI) / 180;
      const lat2 = (b.latitude * Math.PI) / 180;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    }

    let clusterCenter = places[0];
    let bestNeighborCount = -1;
    for (const candidate of places) {
      const neighborCount = places.filter((p) => distanceKm(candidate, p) <= RADIUS_KM).length;
      if (neighborCount > bestNeighborCount) {
        bestNeighborCount = neighborCount;
        clusterCenter = candidate;
      }
    }
    const cluster = places.filter((p) => distanceKm(clusterCenter, p) <= RADIUS_KM);

    const bounds = L.latLngBounds(cluster.map((p) => [p.latitude, p.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: false });
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
        {place.category && (
          <p className="line-clamp-1 text-[10px] leading-none text-ink-secondary">{getCategoryLabel(place.category)}</p>
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
    <div
      className={`relative isolate z-0 h-56 w-full overflow-hidden rounded-card shadow-soft ${IS_USING_FALLBACK_TILES ? "map-branded" : ""}`}
    >
      <MapContainer center={positions[0]} zoom={12} scrollWheelZoom={false} className="h-full w-full" attributionControl={false}>
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
        {validPlaces.map((place) => (
          <Marker key={place.id} position={[place.latitude, place.longitude]} icon={PLACE_ICON}>
            <Popup className="place-preview-popup" minWidth={128} maxWidth={128}>
              <PlacePreview place={place} />
            </Popup>
          </Marker>
        ))}
        <FitBounds places={validPlaces} />
      </MapContainer>
    </div>
  );
}
