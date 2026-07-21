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
}

interface ResultMapProps {
  stops: MapStop[];
}

/** יוצר אייקון סמן מותאם אישית, עם מספר התחנה בתוכו, בגרדיאנט המותג. */
function createNumberedIcon(index: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end));
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
    const bounds = L.latLngBounds(stops.map((s) => [s.latitude, s.longitude]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [stops, map]);
  return null;
}

export function ResultMap({ stops }: ResultMapProps) {
  const validStops = stops.filter((s) => s.latitude != null && s.longitude != null);
  if (validStops.length === 0) return null;

  const positions: [number, number][] = validStops.map((s) => [s.latitude, s.longitude]);

  return (
    <div className="h-64 w-full overflow-hidden rounded-card shadow-soft">
      <MapContainer center={positions[0]} zoom={13} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline
          positions={positions}
          pathOptions={{ color: "var(--color-primary-start)", weight: 3, dashArray: "6 8" }}
        />
        {validStops.map((stop, index) => (
          <Marker key={stop.stopId} position={[stop.latitude, stop.longitude]} icon={createNumberedIcon(index)}>
            <Popup>{stop.name}</Popup>
          </Marker>
        ))}
        <FitBounds stops={validStops} />
      </MapContainer>
    </div>
  );
}