"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MapContainer, TileLayer, AttributionControl, Marker, Popup, useMap } from "react-leaflet";
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
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";
import type { HomeQuickCategoryId } from "@/constants/homeQuickCategories";

/** מרכז ברירת מחדל (תל אביב) - רק עד שמתקבל מיקום אמיתי מהמכשיר, או
 *  כגיבוי אם המשתמש לא אישר הרשאת מיקום. לא "דאטה מדומה" של מקומות -
 *  רק נקודת מבט התחלתית סבירה למפה, באותה רוח כמו הגיבוי הקיים ב-
 *  DiscoveryPlacesMap.tsx (computeClusterView). */
const DEFAULT_CENTER: [number, number] = [32.0853, 34.7818];
const DEFAULT_ZOOM = 13;

/** צורת מקום מוכנה להצגה כ-marker על המפה - מקור הדאטה היחיד מעכשיו
 *  הוא tripadd_submissions (בקשה מפורשת - "כל הדאטה הקודם יעלם, רק
 *  דאטה חדש דרך tripadd"), לא places/destinations הישנים. */
export interface HomeMapPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: HomeQuickCategoryId | null;
  subcategory?: string | null;
  rating?: number | null;
  address?: string | null;
  photoUrl?: string | null;
  /** רמת מחיר 1-4 (כמו שגוגל מספק - לא הומצא מספר מדויק). */
  priceLevel?: number | null;
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

        {/* *** תיקון (בקשה מפורשת - "יותר יפה החלון... עם התמונה,
            כתובת, עלות"): כרטיס תצוגה מקדימה אמיתי - תמונה (google_
            photo_url שכבר נשמר בזמן ההוספה, לא תמונה מומצאת), כתובת,
            רמת מחיר (₪ לפי price_level 1-4 שגוגל בעצמו מספק - לא
            הומצא מחיר מדויק). */}
        {places.map((place) => (
          <Marker key={place.id} position={[place.latitude, place.longitude]} icon={PLACE_ICON}>
            <Popup minWidth={200} maxWidth={240} className="tripadd-popup">
              <div className="overflow-hidden rounded-[10px]">
                {place.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={place.photoUrl} alt={place.name} className="-mx-3 -mt-3 mb-2 h-28 w-[calc(100%+24px)] object-cover" />
                )}
                <p className="text-[14px] font-bold text-ink">{place.name}</p>
                {(place.category || place.subcategory) && (
                  <p className="mt-0.5 text-[12px] text-ink-secondary">
                    {place.category ? HOME_QUICK_CATEGORY_LABELS[place.category] ?? place.category : ""}
                    {place.category && place.subcategory ? " · " : ""}
                    {place.subcategory ?? ""}
                  </p>
                )}
                {place.address && <p className="mt-1 text-[11.5px] text-ink-secondary">📍 {place.address}</p>}
                <div className="mt-1.5 flex items-center gap-3">
                  {place.rating ? <span className="text-[12.5px] font-semibold text-ink">⭐ {place.rating}</span> : null}
                  {place.priceLevel ? <span className="text-[12.5px] text-ink-secondary">{"₪".repeat(place.priceLevel)}</span> : null}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {userLocation && <Marker position={userLocation} icon={USER_LOCATION_ICON} />}
        {userLocation && <RecenterOnLocation center={userLocation} />}
      </MapContainer>
    </div>
  );
});
