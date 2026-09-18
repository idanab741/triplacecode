"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, AttributionControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { IS_USING_FALLBACK_TILES, FALLBACK_TILE_URL, FALLBACK_TILE_SUBDOMAINS, FALLBACK_TILE_ATTRIBUTION, FALLBACK_TILE_MAX_ZOOM } from "@/constants/mapTiles";
import { MapTilerBaseLayer } from "@/components/map/MapTilerBaseLayer";

interface MapStop {
  stopId: string;
  name: string;
  latitude: number;
  longitude: number;
  dayIndex?: number | null;
}

interface ResultMapProps {
  stops: MapStop[];
}

/** פלטת צבעים קבועה לימים - עד 8 ימים מובחנים, אחר כך חוזר על עצמה.
 *  גוונים שנבחרו במכוון להשתלב עם הזהות הכחולה-סגולה של המותג, לא צבעי
 *  ברירת מחדל בהירים/מתנגשים. */
const DAY_COLORS = [
  "#4F7DF3", // כחול-מותג
  "#8B5CF6", // סגול
  "#0EA5A4", // טורקיז
  "#EC4899", // ורוד
  "#6366F1", // אינדיגו
  "#F59E0B", // ענבר
  "#059669", // ירוק-אמרלד
  "#DB2777", // מג'נטה
];

function colorForDay(dayIndex: number | null | undefined): string {
  if (dayIndex == null) return DAY_COLORS[0];
  return DAY_COLORS[(dayIndex - 1) % DAY_COLORS.length];
}

/** יוצר אייקון סמן מותאם אישית, עם מספר התחנה בתוכו, בצבע לפי היום שלו. */
function createNumberedIcon(index: number, color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 32px; height: 32px; border-radius: 50%;
      background: ${color};
      border: 2px solid white; box-shadow: 0 2px 6px rgba(16,24,40,0.3);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: bold; font-size: 13px;
    ">${index + 1}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

/** מתאים אוטומטית את הזום/מרכז המפה כך שכל התחנות יהיו בתוך התצוגה.
 *  תיקון קריסה אמיתית ("Cannot read properties of undefined (reading
 *  '_leaflet_pos')") - זו תקלה מוכרת ב-react-leaflet: setView/fitBounds
 *  עם אנימציה (ברירת המחדל) יכולים לנסות לעדכן מיקום של סמן (DOM node)
 *  שכבר הוסר באמצע המעבר - קורה הרבה יותר בקלות ב-dev (React Strict Mode
 *  מפעיל אפקטים פעמיים), אבל יכול לקרות גם כשה-stops מתעדכנים מהר
 *  (polling/גרירה). animate: false מדלג לגמרי על שכבת האנימציה של
 *  Leaflet, כך שאין מה שיתלוי במיקום DOM שכבר לא קיים. */
function FitBounds({ stops }: { stops: MapStop[] }) {
  const map = useMap();
  useEffect(() => {
    if (stops.length === 0) return;
    if (stops.length === 1) {
      map.setView([stops[0].latitude, stops[0].longitude], 15, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(stops.map((s) => [s.latitude, s.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: false });
  }, [stops, map]);
  return null;
}

export function ResultMap({ stops }: ResultMapProps) {
  const validStops = stops.filter((s) => s.latitude != null && s.longitude != null);
  if (validStops.length === 0) return null;

  const positions: [number, number][] = validStops.map((s) => [s.latitude, s.longitude]);

  // מקבצים לפי יום, כדי לצייר קו מסלול נפרד (ולא ישר) לכל יום בצבע שלו -
  // אחרת קו אחד רציף בין ימים שונים ייצור "קפיצות" גיאוגרפיות לא הגיוניות
  const dayGroups = new Map<number, MapStop[]>();
  for (const stop of validStops) {
    const day = stop.dayIndex ?? 1;
    if (!dayGroups.has(day)) dayGroups.set(day, []);
    dayGroups.get(day)!.push(stop);
  }

  return (
    <div
      className={`tm-result-map relative isolate z-0 h-64 w-full overflow-hidden rounded-card shadow-soft ${IS_USING_FALLBACK_TILES ? "map-branded" : ""}`}
    >
      <MapContainer
        center={positions[0]}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl={false}
      >
        {/* prefix={false} מסיר את התוספת של Leaflet עצמו לשליטה (כולל דגל
            שהם הוסיפו ל"קרדיט" שלהם) - נשאר רק הקרדיט המשפטי הנדרש בפועל
            (OpenStreetMap), לא המותג של Leaflet. */}
        {/* *** תיקון (בקשת המשתמש - "יותר מדי מקומות לא רלוונטיים" +
            "לוקח יותר מדי זמן להיטען"): לא CSS - זה סגנון האריחים עצמו.
            עוברים לסגנון הוקטורי "Base" של MapTiler דרך MapTilerBaseLayer
            (ר' src/constants/mapTiles.ts), עם fallback זמני ל-OSM
            הרגיל אם עדיין אין מפתח מוגדר. */}
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
        {Array.from(dayGroups.entries()).map(([day, dayStops]) => (
          <Polyline
            key={day}
            positions={dayStops.map((s) => [s.latitude, s.longitude] as [number, number])}
            pathOptions={{ color: colorForDay(day), weight: 3, dashArray: "6 8" }}
          />
        ))}
        {validStops.map((stop, index) => (
          <Marker
            key={stop.stopId}
            position={[stop.latitude, stop.longitude]}
            icon={createNumberedIcon(index, colorForDay(stop.dayIndex))}
          >
            <Popup>{stop.name}</Popup>
          </Marker>
        ))}
        <FitBounds stops={validStops} />
      </MapContainer>
    </div>
  );
}
