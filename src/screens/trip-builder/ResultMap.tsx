"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
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

/** פלטת צבעים קבועה לימים - עד 8 ימים מובחנים, אחר כך חוזר על עצמו. */
const DAY_COLORS = [
  "#2563eb", // כחול
  "#e11d48", // אדום-ורוד
  "#16a34a", // ירוק
  "#f59e0b", // כתום
  "#9333ea", // סגול
  "#0891b2", // תכלת
  "#db2777", // ורוד
  "#65a30d", // ירוק-זית
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
    <div className="h-64 w-full overflow-hidden rounded-card shadow-soft">
      <MapContainer center={positions[0]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
    </div>
  );
}
