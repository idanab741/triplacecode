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
  /** תיקון (בקשה מפורשת - "צריך לסדר את המרחק מהמיקום הנוכחי"): כשמוגדר,
   *  המפה ממורכזת על המיקום האמיתי של המשתמש (GPS) במקום על "האשכול
   *  הצפוף ביותר" של המקומות - שיכול להיות רחוק מהמשתמש בפועל אם
   *  המקומות שהתקבלו מפוזרים. אופציונלי (undefined/null) כדי לא לשבור
   *  שימושים קיימים ברכיב הזה (עמודי result וכו') שאין להם מיקום GPS
   *  זמין - שם ממשיכים עם חישוב האשכול הישן כברירת מחדל. */
  userLocation?: { lat: number; lng: number } | null;
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
/**
 * *** תיקון (בקשת המשתמש - "כשנכנסים לאפליקציה זה מציג מרחוק
 * יותר!!!!"): קודם MapContainer תמיד התחיל בזום קבוע מראש (12, סתם
 * מרכז על המקום הראשון ברשימה) - ורק אחרי שהמפה כבר נטענה, FitBounds
 * (useEffect נפרד) "קפץ" ותיקן לזום/מרכז הנכונים. זה יצר רגע אמיתי
 * (לא רק רושם) של תצוגה לא-נכונה כשנכנסים למסך - בדיוק מה שהמשתמש
 * תיאר. התיקון: לחשב את אותו חישוב-אשכול *מראש* (פונקציה טהורה, לא
 * בתוך useEffect) ולהעביר אותו ישירות כ-center/zoom ההתחלתיים של
 * MapContainer - כך שאין בכלל רגע של "לא נכון" לפני שה-JS "מתקן".
 * FitBounds נשאר בנוסף (useEffect), לכיסוי המקרה שבו places משתנה
 * *אחרי* שהמפה כבר על המסך (למשל מעבר בין קטגוריות/טאבים) - אז כן
 * צריך תיקון תגובתי, אבל בטעינה הראשונית כבר לא צריך "לתקן" כלום.
 */
/**
 * *** תיקון (בקשת המשתמש - "עדיין אותו מרחק תצוגה!!!"): הגילוי -
 * fitBounds *תמיד* מתרחק כמה שצריך כדי שכל האשכול ייכנס לתוך הקונטיינר
 * (גובה 224px בלבד) - maxZoom מגביל רק כמה *קרוב* מותר, לא מונע
 * התרחקות כשהאשכול עדיין רחב (גם באשכול "הצפוף ביותר", אם הוא מתפרש
 * על עשרות ק"מ). זו הסיבה שהזום נשאר "רחוק" גם אחרי כל התיקונים
 * הקודמים - הם כולם עדיין השתמשו ב-fitBounds בסוף. הפתרון האמיתי:
 * להפסיק להשתמש ב-fitBounds בכלל. קופצים ישירות למרכז האשכול הצפוף
 * (אותו אלגוריתם איתור-אשכול כמו קודם) ב-**זום קבוע** (FIXED_ZOOM),
 * בלי שום ניסיון "להכיל הכל" - בדיוק העדיפות שהמשתמש ביקש שוב ושוב
 * (קרוב > מכיל את כל הפינים). פינים שנופלים מחוץ לתצוגה זו בחירה
 * מודעת, לא באג.
 */
const FIXED_ZOOM = 13;

function findClusterCenter(places: ValidMapPlace[]): [number, number] {
  if (places.length === 1) return [places[0].latitude, places[0].longitude];

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
  return [clusterCenter.latitude, clusterCenter.longitude];
}

function computeClusterView(
  places: ValidMapPlace[],
  userLocation?: { lat: number; lng: number } | null
): { center: [number, number]; zoom: number } {
  // *** מיקום המשתמש האמיתי (אם קיים) גובר על חישוב האשכול - זו הנקודה
  // שהמשתמש בפועל נמצא בה, לא "איפה שרוב המקומות שהתקבלו נמצאים".
  if (userLocation) return { center: [userLocation.lat, userLocation.lng], zoom: FIXED_ZOOM };
  if (places.length === 0) return { center: [31.5, 34.9], zoom: 8 }; // מרכז ישראל, גיבוי בלבד
  return { center: findClusterCenter(places), zoom: FIXED_ZOOM };
}

function FitBounds({
  places,
  userLocation,
}: {
  places: ValidMapPlace[];
  userLocation?: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], FIXED_ZOOM, { animate: false });
      return;
    }
    if (places.length === 0) return;
    map.setView(findClusterCenter(places), FIXED_ZOOM, { animate: false });
  }, [places, userLocation, map]);
  return null;
}

/** נקודת "אתם כאן" - עיגול כחול שקוף (בסגנון Google Maps/מפות ניווט
 *  מוכר), מובחן בבירור מהפינים האדומים-בצורת-טיפה של המקומות. */
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

export function DiscoveryPlacesMap({ places, userLocation }: DiscoveryPlacesMapProps) {
  const validPlaces = places.filter(
    (p): p is ValidMapPlace => p.latitude != null && p.longitude != null
  );
  if (validPlaces.length === 0) return null;

  const initialView = computeClusterView(validPlaces, userLocation);

  return (
    <div
      className={`relative isolate z-0 h-56 w-full overflow-hidden rounded-card shadow-soft ${IS_USING_FALLBACK_TILES ? "map-branded" : ""}`}
    >
      <MapContainer
        center={initialView.center}
        zoom={initialView.zoom}
        scrollWheelZoom={false}
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
        {validPlaces.map((place) => (
          <Marker key={place.id} position={[place.latitude, place.longitude]} icon={PLACE_ICON}>
            <Popup className="place-preview-popup" minWidth={128} maxWidth={128}>
              <PlacePreview place={place} />
            </Popup>
          </Marker>
        ))}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={USER_LOCATION_ICON} />
        )}
        <FitBounds places={validPlaces} userLocation={userLocation} />
      </MapContainer>
    </div>
  );
}
