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
import { isPlaceOpenNow } from "@/utils/openingHours";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";
import { HOME_QUICK_CATEGORIES, type HomeQuickCategoryId } from "@/constants/homeQuickCategories";

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

/** ממרכזים בפועל את המפה כשמתקבל מיקום אמיתי (לא רק ה-center ההתחלתי
 *  של MapContainer, שלא מתעדכן מעצמו בשינוי prop). *** תיקון (בקשה
 *  מפורשת - "כשהמפה קטנה (והחלק האפור גדול) המרכז צריך להיות המיקום
 *  שלי"): setView לבד ממרכז את הנקודה במרכז הגיאומטרי של כל ה-
 *  container, כולל השטח שמוסתר מאחורי הכרטיס האפור למעלה - בפועל
 *  הנקודה נראית *למעלה* מהאמצע של השטח הגלוי בפועל, לא במרכזו.
 *  panBy([0, obscuredTopPx/2]) מזיז את התוכן כלפי מטה בדיוק בחצי
 *  מגובה השטח החסום, כך שהמיקום ייראה במרכז השטח הגלוי בפועל. */
function RecenterOnLocation({ center, obscuredTopPx }: { center: [number, number]; obscuredTopPx: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, DEFAULT_ZOOM, { animate: true });
    if (obscuredTopPx > 0) {
      map.panBy([0, obscuredTopPx / 2], { animate: true });
    }
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
  // *** תיקון (Bug נמשך - "המצפן עדיין לא עובד"): ref למיקום האחרון
  // הידוע - כדי ש-recenterToUser תמיד יעשה משהו *מיידית וודאי* (למקם
  // מחדש למיקום שכבר יש לנו), במקום להיות תלוי אך ורק בקריאה טרייה
  // ל-getCurrentPositionSafe שיכולה לתקוע בשקט בפעם השנייה בתוך
  // WebView מסוימים (הבקשה הראשונה, בטעינה, כן הצליחה - ראינו את
  // הנקודה הכחולה - אבל bridge ילידי מסוים עלול לא לקרוא ל-callback
  // בפעם השנייה ברצף). לא מוותרים על ניסיון לרענן למיקום עדכני יותר -
  // רק לא תלויים *רק* בו כדי שהכפתור יעשה משהו בכלל.
  const userLocationRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    getCurrentPositionSafe()
      .then(({ lat, lng }) => {
        setCenter([lat, lng]);
        setUserLocation([lat, lng]);
        userLocationRef.current = [lat, lng];
      })
      .catch(() => {
        // אין הרשאה/כשל איתור - נשארים על ברירת המחדל, בלי שגיאה חוסמת.
      });
  }, []);

  // *** כפתור "מצפן"/מיקום-נוכחי - מאתר מחדש בפועל (לא רק חוזר לנקודה
  // ששמורה מהטעינה הראשונית - המשתמש יכול להיות זז מאז) ומזיז את
  // המפה + הנקודה הכחולה אליו, כולל תיקון מירכוז לפי השטח הגלוי.
  // useCallback עם deps ריקים - קורא הכל דרך refs, אז ה-function
  // reference עצמו יציב ותקף לנצח, אין צורך לקרוא ל-onReady שוב בכל
  // רינדור (מספיק פעם אחת ב-mount).
  const recenterToUser = useCallback(() => {
    function moveTo(lat: number, lng: number) {
      mapInstanceRef.current?.setView([lat, lng], DEFAULT_ZOOM, { animate: true });
      if (obscuredTopPxRef.current > 0) {
        mapInstanceRef.current?.panBy([0, obscuredTopPxRef.current / 2], { animate: true });
      }
    }

    // מיד ובוודאות - עם המיקום האחרון הידוע, אם יש (בלי לחכות לרשת).
    if (userLocationRef.current) {
      moveTo(userLocationRef.current[0], userLocationRef.current[1]);
    }

    // ברקע - מנסים לרענן למיקום עדכני יותר. אם זה נכשל/תקוע, כבר
    // עשינו את הפעולה הבסיסית למעלה - הכפתור לא "לא עושה כלום".
    getCurrentPositionSafe()
      .then(({ lat, lng }) => {
        setUserLocation([lat, lng]);
        userLocationRef.current = [lat, lng];
        moveTo(lat, lng);
      })
      .catch(() => {
        // אין הרשאה/כשל איתור טרי - נשארים עם המיקום האחרון הידוע שכבר הזזנו אליו למעלה.
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

        {/* *** כרטיסיית תצוגה מקדימה - סדר מדויק לפי הבקשה המפורשת,
            הכל מיושר לימין (dir="rtl" + text-right):
            1) שורת דירוגים: TRIPLACE (לוגו+כוכב+דירוג) | Google (לוגו+כוכב+דירוג+כמות)
            2) תמונה עגולה (מהמשתמש בלבד, לא Google) + שם המקום (בולד) באותה שורה
            3) כתובת
            4) פתוח/סגור עכשיו - מחושב *חי* (isPlaceOpenNow), לא snapshot ישן
            5) קטגוריה + אייקון בעיגול
            6) מחיר (₪ לפי price_level)
            7) נגישות */}
        {places.map((place) => {
          const openNow = isPlaceOpenNow(place.openingHours);
          const categoryDef = place.category ? HOME_QUICK_CATEGORIES.find((c) => c.id === place.category) : undefined;
          return (
            <Marker key={place.id} position={[place.latitude, place.longitude]} icon={PLACE_ICON}>
              <Popup minWidth={230} maxWidth={250} className="tripadd-popup">
                <div dir="rtl" className="text-right">
                  {/* 1. שורת דירוגים */}
                  {(place.rating || place.googleRating) && (
                    <div className="mb-2 flex items-center justify-end gap-3 border-b border-ink-secondary/10 pb-2">
                      {place.googleRating ? (
                        <div className="flex items-center gap-1">
                          {place.googleRatingCount ? (
                            <span className="text-[10px] text-ink-secondary">({place.googleRatingCount})</span>
                          ) : null}
                          <span className="text-[12px] font-bold text-ink">{place.googleRating}</span>
                          <span className="text-[11px]">⭐</span>
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#4285F4] text-[9px] font-bold text-white">
                            G
                          </span>
                        </div>
                      ) : null}
                      {place.rating ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[12px] font-bold text-ink">{place.rating}</span>
                          <span className="text-[11px]">⭐</span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/images/triplace-logo-black.png" alt="TripAdd" className="h-3 w-auto object-contain" />
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* 2. תמונה עגולה + שם באותה שורה */}
                  <div className="flex items-center justify-end gap-2.5">
                    <p className="min-w-0 flex-1 text-[14.5px] font-bold leading-snug text-ink">{place.name}</p>
                    {place.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={place.photoUrl}
                        alt={place.name}
                        className="h-14 w-14 shrink-0 rounded-full object-cover shadow-soft"
                      />
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-full bg-bg-secondary" />
                    )}
                  </div>

                  {/* 3. כתובת */}
                  {place.address && <p className="mt-2 text-[11.5px] leading-snug text-ink-secondary">{place.address}</p>}

                  {/* 4. פתוח/סגור עכשיו - לא מוצג בכלל אם לא ידוע בוודאות */}
                  {openNow !== null && (
                    <div className="mt-1.5 flex items-center justify-end gap-1.5">
                      <span className="text-[11.5px] font-semibold" style={{ color: openNow ? "#1a9d5c" : "#d94848" }}>
                        {openNow ? "פתוח עכשיו" : "סגור עכשיו"}
                      </span>
                      <span className="h-2 w-2 rounded-full" style={{ background: openNow ? "#1a9d5c" : "#d94848" }} />
                    </div>
                  )}

                  {/* 5. קטגוריה + אייקון בעיגול */}
                  {categoryDef && (
                    <div className="mt-1.5 flex items-center justify-end gap-1.5">
                      <span className="text-[11.5px] text-ink-secondary">
                        {HOME_QUICK_CATEGORY_LABELS[categoryDef.id]}
                        {place.subcategory ? ` · ${place.subcategory}` : ""}
                      </span>
                      <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={categoryDef.imageSrc} alt="" className="h-full w-full object-cover" />
                      </span>
                    </div>
                  )}

                  {/* 6. מחיר */}
                  {place.priceLevel ? (
                    <p className="mt-1.5 text-[12px] font-semibold text-ink-secondary">{"₪".repeat(place.priceLevel)}</p>
                  ) : null}

                  {/* 7. נגישות - לא מוצג בכלל אם לא ידוע */}
                  {place.accessible !== null && place.accessible !== undefined && (
                    <p className="mt-1.5 text-[11.5px] text-ink-secondary">{place.accessible ? "♿ נגיש" : "לא נגיש"}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {userLocation && <Marker position={userLocation} icon={USER_LOCATION_ICON} />}
        {userLocation && <RecenterOnLocation center={userLocation} obscuredTopPx={obscuredTopPx} />}
      </MapContainer>
    </div>
  );
}
