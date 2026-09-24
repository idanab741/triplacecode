"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, AttributionControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { IS_USING_FALLBACK_TILES, FALLBACK_TILE_URL, FALLBACK_TILE_SUBDOMAINS, FALLBACK_TILE_ATTRIBUTION, FALLBACK_TILE_MAX_ZOOM } from "@/constants/mapTiles";
import { MapTilerBaseLayer } from "@/components/map/MapTilerBaseLayer";

/**
 * מפת "מסע" משותפת לעמוד הטיול ולעמודי החוויות (בקשה מפורשת - "עמוד עם מפה עם נעצים בכל המקומות").
 * שני סוגי נעצים: ממוספר (תחנות טיול, בצבע של היום) או תמונה (מקומות בחוויה). קווי מסלול אופציונליים
 * בצבע ובסגנון קו משלהם (רציף/מקווקו - כדי שאפשר יהיה להבדיל גם בלי להסתמך על צבע בלבד).
 * הנעץ הנבחר גדל, מקבל טבעת כחולה ותווית עם השם. לחיצה על נעץ -> onSelect.
 */

export interface JourneyMarker {
  id: string;
  latitude: number;
  longitude: number;
  /** השם - לתווית של הנעץ הנבחר ולקוראי מסך. */
  name: string;
  /** נעץ ממוספר: הטקסט שבתוכו ("1", "2"...). */
  label?: string;
  /** נעץ תמונה: כתובת התמונה (עדיפות על label). */
  imageUrl?: string | null;
  /** צבע הנעץ הממוספר / הטבעת של נעץ התמונה. */
  color: string;
}

export interface JourneyLine {
  id: string;
  points: { latitude: number; longitude: number }[];
  color: string;
  dashed?: boolean;
}

interface JourneyMapProps {
  markers: JourneyMarker[];
  lines?: JourneyLine[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Tailwind לגובה/פינות - ההורה קובע. */
  className?: string;
  /** ריווח ה-fitBounds (px) - למשל כשחלק מהמפה מוסתר מתחת לגיליון שעולה עליה. */
  padding?: { top: number; right: number; bottom: number; left: number };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** תווית השם שמעל הנעץ הנבחר. */
function labelHtml(name: string): string {
  return `<div style="position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;padding:6px 12px;border-radius:999px;background:#fff;color:#0f1419;font:600 13px/1.2 var(--font-sans, Rubik, Arial, sans-serif);box-shadow:0 6px 18px -6px rgba(15,20,25,.35);direction:rtl">${escapeHtml(name)}</div>`;
}

function buildIcon(marker: JourneyMarker, selected: boolean): L.DivIcon {
  if (marker.imageUrl) {
    const size = selected ? 52 : 42;
    const ring = selected ? `3.5px solid ${marker.color}` : "3px solid #fff";
    const html = `<div style="position:relative;width:${size}px;height:${size}px">
      ${selected ? labelHtml(marker.name) : ""}
      <div style="width:100%;height:100%;border-radius:50%;border:${ring};box-shadow:0 4px 12px rgba(15,20,25,.3);overflow:hidden;background:#EFF1F4">
        <img src="${escapeHtml(marker.imageUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block" />
      </div>
    </div>`;
    return L.divIcon({ className: "", html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }

  const size = selected ? 42 : 32;
  const html = `<div style="position:relative;width:${size}px;height:${size}px">
    ${selected ? labelHtml(marker.name) : ""}
    <div style="width:100%;height:100%;border-radius:50%;background:${marker.color};border:3px solid #fff;box-shadow:0 3px 10px rgba(15,20,25,.3);display:flex;align-items:center;justify-content:center;color:#fff;font:700 ${selected ? 15 : 13}px/1 var(--font-sans, Rubik, Arial, sans-serif);box-sizing:border-box">${escapeHtml(marker.label ?? "")}</div>
  </div>`;
  return L.divIcon({ className: "", html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

/** מתאים את התצוגה לכל הנעצים - רק כשרשימת הנעצים עצמה משתנה (לא בכל בחירה).
 *  animate:false - ר' ההסבר ב-ResultMap על קריסת '_leaflet_pos' עם אנימציה. */
function FitToMarkers({ markers, padding }: { markers: JourneyMarker[]; padding: JourneyMapProps["padding"] }) {
  const map = useMap();
  const key = markers.map((m) => `${m.id}:${m.latitude},${m.longitude}`).join("|");
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].latitude, markers[0].longitude], 15, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.latitude, m.longitude]));
    const p = padding ?? { top: 48, right: 40, bottom: 48, left: 40 };
    map.fitBounds(bounds, { paddingTopLeft: [p.left, p.top], paddingBottomRight: [p.right, p.bottom], maxZoom: 16, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** כשבוחרים נעץ מחוץ למפה (למשל מהרשימה) - מזיזים אליו את המפה בלי לשנות זום. */
function PanToSelected({ marker }: { marker: JourneyMarker | null }) {
  const map = useMap();
  useEffect(() => {
    if (!marker) return;
    const point = L.latLng(marker.latitude, marker.longitude);
    if (!map.getBounds().pad(-0.15).contains(point)) map.panTo(point, { animate: false });
  }, [marker, map]);
  return null;
}

export function JourneyMap({ markers, lines = [], selectedId = null, onSelect, className = "h-80", padding }: JourneyMapProps) {
  const selected = markers.find((m) => m.id === selectedId) ?? null;
  const icons = useMemo(() => new Map(markers.map((m) => [m.id, buildIcon(m, m.id === selectedId)])), [markers, selectedId]);

  if (markers.length === 0) return null;

  return (
    <div className={`relative isolate z-0 w-full overflow-hidden ${IS_USING_FALLBACK_TILES ? "map-branded" : ""} ${className}`}>
      <MapContainer
        center={[markers[0].latitude, markers[0].longitude]}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl={false}
        zoomControl={false}
      >
        <AttributionControl position="bottomleft" prefix={false} />
        {IS_USING_FALLBACK_TILES ? (
          <TileLayer attribution={FALLBACK_TILE_ATTRIBUTION} url={FALLBACK_TILE_URL} subdomains={FALLBACK_TILE_SUBDOMAINS} maxZoom={FALLBACK_TILE_MAX_ZOOM} />
        ) : (
          <MapTilerBaseLayer />
        )}

        {/* קו לבן רחב מתחת לכל מסלול - כדי שהצבע יבלוט על כל רקע של מפה */}
        {lines.map((line) => (
          <Polyline
            key={`${line.id}-casing`}
            positions={line.points.map((p) => [p.latitude, p.longitude] as [number, number])}
            pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.9, lineCap: "round", lineJoin: "round" }}
            interactive={false}
          />
        ))}
        {lines.map((line) => (
          <Polyline
            key={line.id}
            positions={line.points.map((p) => [p.latitude, p.longitude] as [number, number])}
            pathOptions={{ color: line.color, weight: 4, lineCap: "round", lineJoin: "round", dashArray: line.dashed ? "2 9" : undefined }}
            interactive={false}
          />
        ))}

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.latitude, marker.longitude]}
            icon={icons.get(marker.id)}
            zIndexOffset={marker.id === selectedId ? 1000 : 0}
            title={marker.name}
            alt={marker.name}
            keyboard
            eventHandlers={onSelect ? { click: () => onSelect(marker.id) } : undefined}
          />
        ))}

        <FitToMarkers markers={markers} padding={padding} />
        <PanToSelected marker={selected} />
      </MapContainer>
    </div>
  );
}

/** צבעי ימים / טיולים: גוונים של המותג שנבדלים גם בבהירות (לא רק בגוון), כך שקל להבחין ביניהם. */
export const JOURNEY_COLORS = ["#0A6DFE", "#E0701A", "#0F766E", "#7C3AED", "#BE185D", "#1E3A5F", "#B45309", "#0891B2"];

export function journeyColor(index: number): string {
  return JOURNEY_COLORS[((index % JOURNEY_COLORS.length) + JOURNEY_COLORS.length) % JOURNEY_COLORS.length];
}

/** קישור ניווט של Google Maps: יעד אחד, או מסלול עם עד 9 עצירות בדרך (מגבלת Google). */
export function directionsUrl(points: { latitude: number; longitude: number }[]): string | null {
  if (points.length === 0) return null;
  const fmt = (p: { latitude: number; longitude: number }) => `${p.latitude},${p.longitude}`;
  const destination = points[points.length - 1];
  const waypoints = points.slice(0, -1).slice(0, 9);
  const params = new URLSearchParams({ api: "1", destination: fmt(destination) });
  if (waypoints.length > 0) params.set("waypoints", waypoints.map(fmt).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
