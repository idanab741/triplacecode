"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { HOME_QUICK_CATEGORIES, type HomeQuickCategoryId } from "@/constants/homeQuickCategories";
import { HomeMapPlacePopupContent } from "./HomeMapPlacePopupContent";

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
  /** דירוג TRIPLACE - שהמשתמש עצמו נתן בטופס הוספת המקום. */
  rating?: number | null;
  /** דירוג ממוצע של Google על אותו מקום - שונה מ-rating (בקשה
   *  מפורשת - "דירוג triplace ודירוג גוגל", שני דברים נפרדים). */
  googleRating?: number | null;
  googleRatingCount?: number | null;
  address?: string | null;
  photoUrl?: string | null;
  /** רמת מחיר 1-4 (כמו שגוגל מספק - לא הומצא מספר מדויק). */
  priceLevel?: number | null;
  /** שעות פתיחה גולמיות מ-Google (טקסט חופשי, 7 שורות) - לחישוב
   *  "פתוח/סגור עכשיו" *חי* בזמן אמת (ר' isPlaceOpenNow), לא תמונת
   *  מצב שמורה שיכולה להתיישן. */
  openingHours?: string[] | null;
  accessible?: boolean | null;
}

interface HomeMapProps {
  places?: HomeMapPlace[];
  className?: string;
  /** גובה (px) של האזור שחוסם את חלק העליון של המפה מלמעלה (הכרטיס
   *  האפור בעמוד הבית) - נדרש כדי למרכז את מיקום המשתמש בתוך השטח
   *  *הגלוי בפועל* של המפה, לא במרכז הגיאומטרי של כל ה-container
   *  (שרובו מוסתר מאחורי הכרטיס כשהוא במצב הרגיל/מוגדל). */
  obscuredTopPx?: number;
  /** *** תיקון (Bug - "הכפתור של המצפן לא עובד, לא קורה כלום"): קודם
   *  זה נחשף דרך `ref` (forwardRef) - אבל HomeMap נטען דרך
   *  `next/dynamic` (בגלל SSR), ו-refs **לא עוברים בצורה אמינה** דרך
   *  קומפוננטה שנטענת ב-dynamic import (מגבלה מתועדת של next/dynamic -
   *  זה לא forwardRef "אמיתי" מבחינת React, זה wrapper של lazy-loading).
   *  בפועל homeMapRef.current נשאר null לנצח, אז הלחיצה על הכפתור
   *  לא עשתה כלום - לא הייתה שום שגיאה כי `?.` פשוט שיתק בשקט. הפתרון:
   *  callback prop רגיל (onReady) במקום ref - props תמיד עוברים
   *  נכון דרך dynamic import, זה רק ref שהיה בעייתי. */
  onReady?: (handle: HomeMapHandle) => void;
}

/** נחשף דרך callback prop (onReady) - לא ref, ר' הערה למעלה. */
export interface HomeMapHandle {
  recenterToUser: () => void;
}

/** מיפוי category -> משתנה-הצבע שלה (אותו colorVar שמוצג כבר מאחורי
 *  העיגול ב-HomeQuickCategories) - מקור אמת יחיד, לא צבעים כפולים. */
const CATEGORY_COLOR_VAR: Partial<Record<string, string>> = Object.fromEntries(
  HOME_QUICK_CATEGORIES.map((c) => [c.id, c.colorVar])
);
const DEFAULT_PIN_COLOR_VAR = "--color-primary-start";

/** *** שינוי (בקשה מפורשת - "שברגע שלוחצים על כפתור סינון, הנעצים
 *  שנשארים יהיו בצבע שמופיע מאחורי העיגול של אותו סוג"): לפני זה כל
 *  הפינים היו באותו כחול קבוע (PLACE_ICON יחיד) - עכשיו כל פין מקבל
 *  אייקון בצבע הקטגוריה שלו (או הצבע הדיפולטי אם אין קטגוריה/לא
 *  מזוהה). ה-cache מונע יצירת L.divIcon מחדש בכל רינדור לכל פין. */
const placeIconCache = new Map<string, L.DivIcon>();
function getPlaceIcon(category?: string | null): L.DivIcon {
  const colorVar = (category && CATEGORY_COLOR_VAR[category]) || DEFAULT_PIN_COLOR_VAR;
  const cached = placeIconCache.get(colorVar);
  if (cached) return cached;
  const icon = L.divIcon({
    className: "",
    html: `<div style="
      width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
      background: var(${colorVar}, #4F7DF3);
      border: 2px solid white; box-shadow: 0 2px 6px rgba(16,24,40,0.35);
      transform: rotate(-45deg);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
  placeIconCache.set(colorVar, icon);
  return icon;
}

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

/**
 * *** תיקון-שורש (Bug נמשך פעמיים - "המצפן עדיין לא עובד"): החשד
 * הקודם היה על ref ש-next/dynamic לא מעביר טוב - זה תוקן, אבל
 * הבעיה נמשכה. הסיבה האמיתית כנראה עמוקה יותר: `<MapContainer
 * ref={...}>` לא בהכרח נותן בפועל את ה-instance האמיתי של Leaflet
 * בכל גרסה/תצורה - זו לא הדרך הרשמית/המתועדת של react-leaflet
 * לקבל את ה-map. הדרך הרשמית היחידה שמובטחת לעבוד היא ה-hook
 * `useMap()`, בתוך רכיב-ילד שממש נמצא בתוך <MapContainer>. הרכיב
 * הקטן הזה עושה בדיוק את זה: תופס את ה-map האמיתי דרך useMap(),
 * ומעביר אותו החוצה (ל-state של HomeMap, לא ref) ברגע שהוא זמין -
 * שום ניחוש/הנחה על התנהגות ref יותר.
 */
function CaptureMapInstance({ onReady }: { onReady: (map: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

/**
 * *** תיקון-שורש (Bug - "המפה ירדה דרומה, לא קשור למיקום שלי בכלל"):
 * הגרסה הקודמת עשתה setView (עם animate:true) ואז מיד panBy (גם עם
 * animate:true) - שתי קריאות אנימציה נפרדות ברצף. בטעינה הראשונית
 * (מפה "נקייה", בלי אנימציה קודמת) זה נראה נכון במקרה - אבל בלחיצה
 * על הכפתור, כשהמפה כבר "באמצע" אינטראקציה כלשהי, שרשור כזה של שתי
 * אנימציות ברצף מיידי לא צפוי ומתנהג בצורה לא עקבית.
 *
 * הפתרון הנכון: חישוב מתמטי בודד - ממירים את מיקום המשתמש למרחב
 * פיקסלים (map.project), מזיזים אותו כלפי *צפון* (Y קטן יותר בפיקסלים
 * = צפון) בדיוק בחצי מגובה השטח החסום, וממירים בחזרה לקואורדינטות
 * (map.unproject). merkaz שנקבע צפונה-מהמשתמש גורם למשתמש להיראות
 * *נמוך יותר על המסך* - בתוך השטח הגלוי, לא מוסתר מאחורי הכרטיס.
 * קריאה **אחת** אטומית ל-setView, בלי לשרשר שתי אנימציות נפרדות.
 */
function computeOffsetCenter(map: LeafletMap, lat: number, lng: number, obscuredTopPx: number): [number, number] {
  if (obscuredTopPx <= 0) return [lat, lng];
  const targetPoint = map.project([lat, lng], DEFAULT_ZOOM);
  const shiftedPoint = targetPoint.subtract([0, obscuredTopPx / 2]);
  const shiftedLatLng = map.unproject(shiftedPoint, DEFAULT_ZOOM);
  return [shiftedLatLng.lat, shiftedLatLng.lng];
}

/** ממרכזים בפועל את המפה כשמתקבל מיקום אמיתי (לא רק ה-center ההתחלתי
 *  של MapContainer, שלא מתעדכן מעצמו בשינוי prop). ר' computeOffsetCenter
 *  למעלה - קריאת setView אחת ואטומית, לא שתי אנימציות משורשרות. */
function RecenterOnLocation({ center, obscuredTopPx }: { center: [number, number]; obscuredTopPx: number }) {
  const map = useMap();
  useEffect(() => {
    const [lat, lng] = computeOffsetCenter(map, center[0], center[1], obscuredTopPx);
    map.setView([lat, lng], DEFAULT_ZOOM, { animate: true });
  }, [center, obscuredTopPx, map]);
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
export function HomeMap({ places = [], className, obscuredTopPx = 0, onReady }: HomeMapProps) {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  // *** תיקון-שורש (ר' CaptureMapInstance למעלה) - ref פנימי שמתמלא
  // ע"י ה-hook הרשמי useMap(), לא ע"י ref על MapContainer עצמו.
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const handleMapReady = useCallback((map: LeafletMap) => {
    mapInstanceRef.current = map;
  }, []);
  // ref ל-obscuredTopPx העדכני ביותר - כדי ש-recenterToUser תמיד
  // יקרא את הערך העדכני, לא אחד תקוע מרגע היצירה.
  const obscuredTopPxRef = useRef(obscuredTopPx);
  obscuredTopPxRef.current = obscuredTopPx;

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

  // *** כפתור "מצפן"/מיקום-נוכחי - מאתר מחדש בפועל (לא רק חוזר לנקודה
  // ששמורה מהטעינה הראשונית - המשתמש יכול להיות זז מאז) ומזיז את
  // המפה + הנקודה הכחולה אליו, עם אותו חישוב מירכוז אטומי בדיוק כמו
  // RecenterOnLocation (computeOffsetCenter) - לא עוד שרשור נפרד של
  // שתי אנימציות (זה מה שגרם ל"קפיצה דרומה לא קשורה"). קריאה בודדת
  // ל-getCurrentPositionSafe בלבד (לא שתיים ברצף) - עכשיו שהלחיצה
  // עצמה מאושרת עובדת (הטבעת הפועמת), אין צורך בהזזה כפולה שיכלה
  // לתרום לתוצאה הבלתי-צפויה.
  const recenterToUser = useCallback(() => {
    getCurrentPositionSafe()
      .then(({ lat, lng }) => {
        setUserLocation([lat, lng]);
        const map = mapInstanceRef.current;
        if (!map) return;
        const [targetLat, targetLng] = computeOffsetCenter(map, lat, lng, obscuredTopPxRef.current);
        map.setView([targetLat, targetLng], DEFAULT_ZOOM, { animate: true });
      })
      .catch(() => {
        // אין הרשאה/כשל איתור טרי - אין מיקום אמיתי חדש למרכז אליו.
      });
  }, []);

  useEffect(() => {
    onReady?.({ recenterToUser });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        center={center}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        zoomControl
        style={{ height: "100%", width: "100%" }}
        attributionControl={false}
      >
        <CaptureMapInstance onReady={handleMapReady} />
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

        {/* *** חלונית המקום - עוצבה מחדש (ר' PlaceMapPopupCard.tsx):
            קומפקטית, RTL אמיתי, רק אייקונים/נכסים קיימים. כל הלוגיקה
            (דירוגים/תמונה/שם/כתובת/פתוח-סגור/קטגוריה/Waze/גוגל-מפות/
            שמירה-אמיתית/שיתוף) עברה ל-HomeMapPlacePopupContent, כדי
            שה-JSX כאן יישאר פשוט ולא יתנפח עם עוד תיקון-על-גבי-תיקון.
            closeButton={false} - יש לחלונית כפתור X משלה (בהתאם ל-RTL,
            בצד שמאל), לא כפתור ה-X הדיפולטי של Leaflet. */}
        {places.map((place) => (
          <Marker key={place.id} position={[place.latitude, place.longitude]} icon={getPlaceIcon(place.category)}>
            <Popup minWidth={300} maxWidth={340} closeButton={false} className="place-map-popup">
              <HomeMapPlacePopupContent place={place} />
            </Popup>
          </Marker>
        ))}

        {userLocation && <Marker position={userLocation} icon={USER_LOCATION_ICON} />}
        {userLocation && <RecenterOnLocation center={userLocation} obscuredTopPx={obscuredTopPx} />}
      </MapContainer>
    </div>
  );
}
