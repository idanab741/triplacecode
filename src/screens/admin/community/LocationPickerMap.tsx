"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { IS_USING_FALLBACK_TILES, FALLBACK_TILE_URL, FALLBACK_TILE_SUBDOMAINS, FALLBACK_TILE_ATTRIBUTION, FALLBACK_TILE_MAX_ZOOM } from "@/constants/mapTiles";
import { MapTilerBaseLayer } from "@/components/map/MapTilerBaseLayer";

const ISRAEL_CENTER: [number, number] = [31.8, 34.9];

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;transform:translate(-15px,-30px)">
    <svg width="30" height="30" viewBox="0 0 24 24" fill="#1f6fe5" stroke="#fff" stroke-width="1.5"><path d="M12 22s8-6 8-12a8 8 0 0 0-16 0c0 6 8 12 8 12z"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>
  </div>`,
  iconSize: [0, 0],
});

function Recenter({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), 15), { animate: true });
  }, [map, position]);
  return null;
}

function ClickToMove({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** מפה לתיקון מיקום: גוררים את הסיכה או לוחצים על המפה כדי להזיז אותה.
 *  חובה לייבא עם dynamic(..., { ssr: false }). */
export default function LocationPickerMap({
  latitude,
  longitude,
  onChange,
  height = 280,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}) {
  const position = useMemo<[number, number] | null>(() => (latitude != null && longitude != null ? [latitude, longitude] : null), [latitude, longitude]);

  return (
    <div className="overflow-hidden rounded-[var(--admin-radius-md)] border" style={{ height, borderColor: "var(--admin-border)", direction: "ltr", isolation: "isolate" }}>
      <MapContainer center={position ?? ISRAEL_CENTER} zoom={position ? 15 : 7} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        {IS_USING_FALLBACK_TILES ? (
          <TileLayer url={FALLBACK_TILE_URL} subdomains={FALLBACK_TILE_SUBDOMAINS} attribution={FALLBACK_TILE_ATTRIBUTION} maxZoom={FALLBACK_TILE_MAX_ZOOM} />
        ) : (
          <MapTilerBaseLayer variant="streets" />
        )}
        <Recenter position={position} />
        <ClickToMove onPick={onChange} />
        {position && (
          <Marker
            position={position}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                onChange(ll.lat, ll.lng);
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
