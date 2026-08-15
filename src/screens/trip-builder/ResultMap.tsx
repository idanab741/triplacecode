"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, AttributionControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

/** מתאים אוטומטית את הזום/מרכז המפה כך שכל התחנות יהיו בתוך התצוגה. */
function FitBounds({ stops }: { stops: MapStop[] }) {
  const map = useMap();
  useEffect(() => {
    if (stops.length === 0) return;
    if (stops.length === 1) {
      map.setView([stops[0].latitude, stops[0].longitude], 15);
      return;
    }
    const bounds = L.latLngBounds(stops.map((s) => [s.latitude, s.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
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
    <div className="tm-result-map relative isolate z-0 h-64 w-full overflow-hidden rounded-card shadow-soft">
      <MapContainer
        center={positions[0]}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl={false}
      >
        {/* prefix={false} מסיר את התוספת של Leaflet עצמו לשליטה (כולל דגל
            שהם הוסיפו ל"קרדיט" שלהם) - נשאר רק הקרדיט המשפטי הנדרש בפועל
            (CARTO/OpenStreetMap), לא המותג של Leaflet. */}
        {/* *** שינוי: עברנו מ-OSM סטנדרטי (+ CSS filter שניסה "לצבוע
            מחדש") ל-CARTO Voyager - בסיס מפה איכותי ומעוצב בפועל (לא
            טריק CSS), עם פלטה נקייה ומודרנית שמתאימה הרבה יותר לזהות
            האפליקציה. *** טרייד-אוף מודע: ב-Voyager שמות מקומות בישראל
            מוצגים בתעתיק אנגלי במקום עברית (זו הסיבה שבעבר נשארנו עם
            OSM סטנדרטי) - אם זה מפריע במסכי טיולים בארץ, אפשר להחזיר
            תנאי שמחליף ספק לפי מיקום (ישראל -> OSM, אחרת -> Voyager). */}
        <AttributionControl position="bottomright" prefix={false} />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
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

      {/* Voyager (CARTO) כבר מגיע בפלטה מעוצבת ונקייה מהקופסה - אין צורך
          יותר בשכבת overlay/filter ידני מעל האריחים. */}
    </div>
  );
}
