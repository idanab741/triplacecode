"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, AttributionControl, Marker, Popup, useMap } from "react-leaflet";
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
import { getPhotoPinIcon } from "@/screens/home/photoPin";
import { NearbyPlacePopupContent } from "@/screens/home/NearbyPlacePopupContent";

export interface NearbyMapPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  imageUrls?: string[] | null;
  rating?: number | null;
  ratingCount?: number | null;
  distanceKm?: number | null;
  city?: string | null;
  subcategoryLabel?: string | null;
  openingHours?: string[] | null;
}

interface HomeNearbyMapProps {
  places: NearbyMapPlace[];
  userLocation: { lat: number; lng: number };
  /** צבע הנעצים (צבע CSS) - זהה לצבע האייקון של הלשונית. */
  pinColor: string;
  /** תווית לספירה שמוצגת בפינת המפה, למשל "תצפיות". */
  countLabel: string;
  /** הלשונית הפעילה - תווית ואייקון הקטגוריה בכרטיסיית המקום. */
  categoryLabel: string;
  categoryIconSrc: string;
}

/** כמה מהמקומות הקרובים ביותר נכנסים לפריים ההתחלתי (יחד עם המשתמש). */
const FIT_NEAREST = 8;

/** *** בקשה מפורשת ("המקומות צריכים להיות בתוך המפה"): בניגוד למפת ה-Discovery
 *  (זום קבוע סביב המשתמש - שבקטגוריות דלילות כמו תצפיות משאיר את הנעצים מחוץ
 *  לפריים), כאן המפה מותאמת אוטומטית כך שהמשתמש ו-8 המקומות הקרובים ביותר
 *  יופיעו בפריים, עם זום מקסימלי סביר כדי שלא תתקרב יותר מדי. */
function FitToNearest({ places, userLocation }: { places: NearbyMapPlace[]; userLocation: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    const nearest = [...places]
      .sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY))
      .slice(0, FIT_NEAREST);
    const points: L.LatLngTuple[] = [[userLocation.lat, userLocation.lng], ...nearest.map((p): L.LatLngTuple => [p.latitude, p.longitude])];
    map.invalidateSize();
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: false });
      return;
    }
    // padding תחתון גדול: הלשוניות מרחפות על המפה בחלק התחתון (HomeNearbyRow) -
    // הנעצים לא אמורים להיות מוסתרים מאחוריהן. עליון: בשביל תג הספירה.
    map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [46, 64], paddingBottomRight: [46, 118], maxZoom: 15, animate: false });
  }, [places, userLocation, map]);
  return null;
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

export function HomeNearbyMap({ places, userLocation, pinColor, countLabel, categoryLabel, categoryIconSrc }: HomeNearbyMapProps) {
  return (
    // ממלא את המיכל של HomeNearbyRow (הוא זה שמגדיר גובה, פינות וצל).
    <div className={`relative isolate z-0 h-full w-full ${IS_USING_FALLBACK_TILES ? "map-branded" : ""}`}>
      <MapContainer
        center={[userLocation.lat, userLocation.lng]}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl={false}
      >
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

        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
            icon={getPhotoPinIcon(pinColor, place.imageUrls?.[0])}
          >
            {/* *** הכרטיסייה החדשה (PlaceMapPopupCard) - אותה חלונית של מפת הבית.
                autoPan עם ריפוד: לא נפתחת מאחורי הלשוניות שמרחפות בתחתית המפה
                ולא מאחורי תג הספירה למעלה. */}
            <Popup
              minWidth={300}
              maxWidth={340}
              closeButton={false}
              className="place-map-popup"
              autoPanPaddingTopLeft={[16, 64]}
              autoPanPaddingBottomRight={[16, 120]}
            >
              <NearbyPlacePopupContent place={place} categoryLabel={categoryLabel} categoryIconSrc={categoryIconSrc} />
            </Popup>
          </Marker>
        ))}

        <Marker position={[userLocation.lat, userLocation.lng]} icon={USER_LOCATION_ICON} />
        <FitToNearest places={places} userLocation={userLocation} />
      </MapContainer>

      {/* ספירה בפינת המפה */}
      <div className="pointer-events-none absolute right-3 top-3 z-[1000] rounded-pill bg-white/95 px-3 py-1.5 text-xs font-bold text-ink shadow-[0_6px_16px_-6px_rgba(20,50,110,0.5)] backdrop-blur-sm">
        {places.length} {countLabel} בקרבתכם
      </div>
    </div>
  );
}
