"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, AttributionControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { IS_USING_FALLBACK_TILES, FALLBACK_TILE_URL, FALLBACK_TILE_SUBDOMAINS, FALLBACK_TILE_ATTRIBUTION, FALLBACK_TILE_MAX_ZOOM } from "@/constants/mapTiles";
import { MapTilerBaseLayer } from "@/components/map/MapTilerBaseLayer";
import { getPhotoPinIcon } from "@/screens/places/friendPin";
import type { JourneyLine, JourneyMarker } from "./journeyUtils";

// תאימות לאחור - הטיפוסים והעזרים חיים ב-journeyUtils.ts (בלי Leaflet), כדי שעמודים יוכלו לייבא
// אותם בלי לטעון את ספריית המפה בשרת.
export { JOURNEY_COLORS, journeyColor, directionsUrl, type JourneyLine, type JourneyMarker } from "./journeyUtils";

/**
 * מפת "מסע" משותפת לעמוד הטיול ולעמודי החוויות (בקשה מפורשת - "עמוד עם מפה עם נעצים בכל המקומות").
 * שני סוגי נעצים: ממוספר (תחנות טיול, בצבע של היום) או תמונה (מקומות בחוויה). קווי מסלול אופציונליים
 * בצבע ובסגנון קו משלהם (רציף/מקווקו - כדי שאפשר יהיה להבדיל גם בלי להסתמך על צבע בלבד).
 * הנעץ הנבחר גדל, מקבל טבעת כחולה ותווית עם השם. לחיצה על נעץ -> onSelect.
 */

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

/** *** בקשה מפורשת ("המפה צריכה להיות זהה למפה שלנו ב-places, עם אותם פינים"): אותו נעץ-תמונה של
 *  מפת place's (ר' getPhotoPinIcon), עם מספר התחנה בפינה בצבע היום/המסלול, ומסגרת בצבע הזה כשנבחר. */
function buildIcon(marker: JourneyMarker, selected: boolean): L.DivIcon {
  return getPhotoPinIcon({
    photoUrl: marker.imageUrl ?? null,
    selected,
    accent: marker.color,
    badge: marker.label,
    badgeColor: marker.color,
    label: marker.name,
  });
}

const PIN_TOP_ROOM = 56;

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
    // הנעץ מעוגן בקצה הזנב (כמו במפת place's) ומעליו התמונה ושם המקום כשנבחר - לכן מקום נוסף למעלה.
    map.fitBounds(bounds, { paddingTopLeft: [p.left, p.top + PIN_TOP_ROOM], paddingBottomRight: [p.right, p.bottom], maxZoom: 16, animate: false });
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
    <div className={`journey-map relative isolate z-0 w-full overflow-hidden bg-[#F2F0EB] ${IS_USING_FALLBACK_TILES ? "map-branded" : ""} ${className}`}>
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
          <MapTilerBaseLayer refined />
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
