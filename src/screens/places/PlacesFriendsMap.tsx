"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, AttributionControl, Marker, useMap } from "react-leaflet";
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
import { getAvatarUrl } from "@/constants/avatar";
import { getSessionLocation } from "@/utils/sessionLocation";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";
import type { FriendsMapPin } from "@/services/social/friendsMapService";
import { getFriendPinIcon } from "./friendPin";

type Filter = "all" | "friends" | "mine";
type LatLng = { lat: number; lng: number };

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "friends", label: "חברים" },
  { id: "mine", label: "שלי" },
];

const USER_ICON = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#4285F4;border:3px solid #fff;box-shadow:0 0 0 2px rgba(66,133,244,0.35),0 2px 6px rgba(16,24,40,0.35);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** מרחק אנכי (px) שמזיזים את מרכז המפה כדי שהנעץ הנבחר יופיע *מעל* פס הכרטיסים שבתחתית. */
const SELECT_OFFSET_PX = 60;

/** רדיוס (ק"מ) של "אזור אחד" - פינים רחוקים יותר לא נכנסים לתצוגה ההתחלתית. */
const NEAR_KM = 60;

function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** *** תיקון (בקשה מפורשת - "המפה הרוסה, מוצגת מרחוק כל העולם"): קודם התאמנו את התצוגה
 *  לכל הפינים יחד עם המשתמש - וכשהמשתמש בישראל ופין בניו יורק, זה זום-אאוט על כל
 *  העולם. עכשיו מתמקדים ב"אזור" אחד בלבד: הפינים שבטווח NEAR_KM מהמשתמש (יחד איתו),
 *  ואם אין כאלה - האשכול סביב ההמלצה העדכנית ביותר. לפינים רחוקים מגיעים דרך הכרטיסים. */
function pickFocusPoints(pins: FriendsMapPin[], userLoc: LatLng | null): L.LatLngTuple[] {
  if (pins.length === 0) return userLoc ? [[userLoc.lat, userLoc.lng]] : [];
  if (userLoc) {
    const near = pins.filter((p) => distanceKm(userLoc, { lat: p.latitude, lng: p.longitude }) <= NEAR_KM);
    if (near.length > 0) return [...near.map((p): L.LatLngTuple => [p.latitude, p.longitude]), [userLoc.lat, userLoc.lng]];
  }
  const anchor = { lat: pins[0].latitude, lng: pins[0].longitude };
  return pins
    .filter((p) => distanceKm(anchor, { lat: p.latitude, lng: p.longitude }) <= NEAR_KM)
    .map((p): L.LatLngTuple => [p.latitude, p.longitude]);
}

/** מכוון את המפה: התאמה לכל הפינים כשהסט משתנה, טיסה לפין שנבחר בידי המשתמש,
 *  וחזרה למיקום המשתמש. ה-tokens הם "טריגרים" - קידום שלהם מפעיל את הפעולה. */
function MapController({
  pins,
  userLoc,
  fitToken,
  fly,
  locateToken,
}: {
  pins: FriendsMapPin[];
  userLoc: LatLng | null;
  fitToken: string;
  fly: { key: string; n: number } | null;
  locateToken: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const points = pickFocusPoints(pins, userLoc);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [44, 72], paddingBottomRight: [44, 150], maxZoom: 15, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken]);

  useEffect(() => {
    if (!fly) return;
    const pin = pins.find((p) => p.key === fly.key);
    if (!pin) return;
    const zoom = Math.max(map.getZoom(), 14);
    const shifted = map.project(L.latLng(pin.latitude, pin.longitude), zoom).add([0, SELECT_OFFSET_PX]);
    map.flyTo(map.unproject(shifted, zoom), zoom, { duration: 0.55 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fly?.n]);

  useEffect(() => {
    if (!locateToken || !userLoc) return;
    map.flyTo([userLoc.lat, userLoc.lng], 15, { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateToken]);

  return null;
}

function AvatarStack({ recommenders }: { recommenders: FriendsMapPin["recommenders"] }) {
  return (
    <span className="flex -space-x-1.5 rtl:space-x-reverse">
      {recommenders.slice(0, 3).map((r) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={r.id} src={getAvatarUrl(r.avatarUrl)} alt="" className="h-5 w-5 rounded-full object-cover ring-2 ring-white" />
      ))}
    </span>
  );
}

function recommendersLabel(pin: FriendsMapPin): string {
  const others = pin.recommenders.filter((r) => !r.isSelf);
  const self = pin.hasSelf;
  if (others.length === 0) return "המלצה שלך";
  const first = others[0].name;
  const extra = pin.recommendersCount - 1;
  if (extra <= 0) return `${first} המליץ/ה`;
  return self && others.length === 1 ? `${first} ואתם המלצתם` : `${first} ועוד ${extra} המליצו`;
}

/**
 * *** חדש (בקשה מפורשת - "בוא נכניס את המפה לעמוד המפה: מפה מלאה בעיצוב מיוחד כמו
 * שלנו"): לשונית "מפה" ב-place's. מפה בגודל המיכל, בסגנון המותג (אריחי MapTiler
 * בגוון סגול), כל המקומות שהחברים המליצו עליהם כנעצים עם תמונה ואווטאר, ופס כרטיסים
 * גולל בתחתית - גלילת הכרטיסים מזיזה את המפה לנעץ, ולחיצה על נעץ גוללת לכרטיס.
 * סינון: הכל / חברים / שלי. לחיצה על כרטיס פותחת את עמוד המקום.
 * הנתונים מ-/api/social/map (ר' friendsMapService.ts).
 */
export function PlacesFriendsMap({
  onCreate,
  onInteractingChange,
  topOffsetPx = 12,
}: {
  onCreate?: () => void;
  /** נקרא כשהאצבע נוגעת במפה (true) ובעת הרמתה (false) - העמוד מסתיר בזמן הזה את הטאבים. */
  onInteractingChange?: (active: boolean) => void;
  /** מרחק מהקצה העליון (px) לשורת הסינון/המיקום - מתעדכן כשהטאבים מוצגים/מוסתרים. */
  topOffsetPx?: number;
}) {
  const router = useRouter();
  const [pins, setPins] = useState<FriendsMapPin[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [fly, setFly] = useState<{ key: string; n: number } | null>(null);
  const [locateToken, setLocateToken] = useState(0);
  const [userLoc, setUserLoc] = useState<LatLng | null>(() => {
    const saved = getSessionLocation();
    return saved ? { lat: saved.lat, lng: saved.lng } : null;
  });

  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const programmaticRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/social/map")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setPins((data.pins ?? []) as FriendsMapPin[]);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setPins([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!pins) return [];
    if (filter === "friends") return pins.filter((p) => p.hasFriend);
    if (filter === "mine") return pins.filter((p) => p.hasSelf);
    return pins;
  }, [pins, filter]);

  const activeKey = filtered.some((p) => p.key === selectedKey) ? selectedKey : (filtered[0]?.key ?? null);
  const fitToken = `${filter}|${filtered.map((p) => p.key).join(",")}`;

  /** בחירה בידי המשתמש (לחיצה על נעץ / גלילת כרטיסים): גם בוחרת וגם מטיסה את המפה. */
  function selectByUser(key: string) {
    setSelectedKey(key);
    setFly((prev) => ({ key, n: (prev?.n ?? 0) + 1 }));
  }

  function handlePinTap(key: string) {
    programmaticRef.current = true;
    selectByUser(key);
    cardRefs.current.get(key)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    window.setTimeout(() => {
      programmaticRef.current = false;
    }, 800);
  }

  /** בסיום גלילת הכרטיסים - בוחרים את הכרטיס הקרוב ביותר למרכז הפס. */
  function handleCardsScroll() {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      if (programmaticRef.current) return;
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const sr = scroller.getBoundingClientRect();
      const centerX = sr.left + sr.width / 2;
      let bestKey: string | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      cardRefs.current.forEach((el, key) => {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.left + r.width / 2 - centerX);
        if (dist < bestDist) {
          bestDist = dist;
          bestKey = key;
        }
      });
      if (bestKey && bestKey !== activeKey) selectByUser(bestKey);
    }, 130);
  }

  async function handleLocate() {
    const loc = userLoc ?? (await getCurrentPositionSafe().catch(() => null));
    if (!loc) return;
    setUserLoc(loc);
    setLocateToken((n) => n + 1);
  }

  const initialCenter: [number, number] = filtered[0]
    ? [filtered[0].latitude, filtered[0].longitude]
    : userLoc
      ? [userLoc.lat, userLoc.lng]
      : [32.0853, 34.7818];

  const isEmpty = pins !== null && filtered.length === 0;

  return (
    // *** תיקון (בקשה מפורשת - "המפה צריכה להיות בגוונים ובעיצוב שלנו, כמו מפת עמוד הבית"):
    // אותו סגנון בסיס בדיוק כמו מפת הבית (MapTiler DATAVIZ, ובגיבוי OSM עם map-branded) -
    // ברור וקריא, בלי הפילטר שעימעם. הגוון של place's בא ממעטפת סגולה עדינה מעל האריחים
    // (רק 7% - לא פוגעת בקריאות), מהנעצים, מהכרטיסים ומהבקרים.
    <div
      className={`places-friends-map relative isolate z-0 h-full w-full overflow-hidden bg-[#EEF0F4] ${
        IS_USING_FALLBACK_TILES ? "map-branded" : ""
      }`}
      onPointerDownCapture={() => onInteractingChange?.(true)}
      onPointerUpCapture={() => onInteractingChange?.(false)}
      onPointerCancelCapture={() => onInteractingChange?.(false)}
    >
      {pins === null ? (
        <div className="absolute inset-0 animate-pulse bg-[#EEF0F4]" />
      ) : (
        <MapContainer center={initialCenter} zoom={13} zoomControl={false} scrollWheelZoom={false} className="h-full w-full" attributionControl={false}>
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

          {filtered.map((pin) => (
            <Marker
              key={pin.key}
              position={[pin.latitude, pin.longitude]}
              icon={getFriendPinIcon({
                photoUrl: pin.imageUrl,
                count: pin.recommendersCount,
                selected: pin.key === activeKey,
              })}
              zIndexOffset={pin.key === activeKey ? 1000 : 0}
              eventHandlers={{ click: () => handlePinTap(pin.key) }}
            />
          ))}

          {userLoc && <Marker position={[userLoc.lat, userLoc.lng]} icon={USER_ICON} zIndexOffset={-500} />}
          <MapController pins={filtered} userLoc={userLoc} fitToken={fitToken} fly={fly} locateToken={locateToken} />
        </MapContainer>
      )}

      {/* מעטפת סגולה עדינה - הגוון של place's על המפה (מעל האריחים והנעצים, מתחת לבקרים) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[500] bg-[rgba(124,58,237,0.07)]" />

      {/* סינון + מיקום שלי */}
      <div
        className="absolute inset-x-3 z-[1000] flex items-center justify-between"
        style={{ top: topOffsetPx, transition: "top 320ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="flex rounded-full bg-white/95 p-1 shadow-[0_8px_22px_-10px_rgba(60,20,140,0.55)] ring-1 ring-black/5 backdrop-blur-md" role="tablist" aria-label="סינון המלצות">
          {FILTERS.map((f) => {
            const selected = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
                  selected ? "text-white" : "text-ink-secondary"
                }`}
                style={selected ? { background: "linear-gradient(135deg, var(--color-places-violet), var(--color-places-purple))" } : undefined}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleLocate}
          aria-label="המיקום שלי"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-places-purple shadow-[0_8px_22px_-10px_rgba(60,20,140,0.55)] ring-1 ring-black/5 backdrop-blur-md transition active:scale-95"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2" />
            <circle cx="12" cy="12" r="7.6" />
          </svg>
        </button>
      </div>

      {/* מצב ריק / שגיאה */}
      {isEmpty && (
        <div className="absolute inset-x-6 top-1/2 z-[1000] -translate-y-[60%] rounded-3xl bg-white/95 p-6 text-center shadow-[0_24px_60px_-20px_rgba(60,20,140,0.6)] ring-1 ring-black/5 backdrop-blur-md">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-places-bg text-places-purple">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
          <p className="mt-3 text-[16px] font-extrabold text-ink">
            {error ? "לא הצלחנו לטעון את המפה" : filter === "mine" ? "עוד לא המלצתם על מקומות" : "אין עדיין המלצות על המפה"}
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-secondary">
            {error
              ? "נסו שוב בעוד רגע."
              : "כשתפרסמו פוסט על מקום, או שחברים ימליצו על מקומות, הם יופיעו כאן על המפה."}
          </p>
          {!error && onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="mt-4 rounded-full px-6 py-2.5 text-[13.5px] font-bold text-white shadow-[0_10px_22px_-10px_rgba(124,58,237,0.9)] transition active:scale-95"
              style={{ background: "linear-gradient(135deg, var(--color-places-violet), var(--color-places-purple))" }}
            >
              צור פוסט על מקום
            </button>
          )}
        </div>
      )}

      {/* פס הכרטיסים - קומפקטי (בקשה מפורשת - "הכרטיסיות למטה גדולות מדי"). ריפוד עליון/תחתון בפס
          (pt-2/pb-3) - בלעדיו overflow-x חתך את המסגרת הסגולה של הכרטיס הנבחר בחלקה העליון
          ואת הצל בתחתית (בקשה מפורשת - "הכרטיסייה חתוכה"). */}
      {filtered.length > 0 && (
        <div
          ref={scrollerRef}
          onScroll={handleCardsScroll}
          className="stories-rail-track absolute inset-x-0 bottom-4 z-[1000] flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-3 pt-2"
          style={{ scrollbarWidth: "none" }}
        >
          {filtered.map((pin) => {
            const selected = pin.key === activeKey;
            return (
              <button
                key={pin.key}
                ref={(el) => {
                  if (el) cardRefs.current.set(pin.key, el);
                  else cardRefs.current.delete(pin.key);
                }}
                type="button"
                onClick={() => router.push(`/place/${pin.placeId}`)}
                className={`w-[68%] max-w-[260px] shrink-0 snap-center rounded-2xl bg-white p-2.5 text-start shadow-[0_12px_28px_-12px_rgba(20,10,60,0.55)] transition-all duration-300 ${
                  selected ? "ring-2 ring-places-purple" : "opacity-95 ring-1 ring-black/5"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {pin.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pin.imageUrl} alt="" draggable={false} className="h-[50px] w-[50px] shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl bg-places-bg text-xl">📍</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-extrabold leading-tight text-ink">{pin.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-secondary">
                      {pin.rating != null && (
                        <>
                          <span className="text-[#F59E0B]">★</span>
                          <span className="font-semibold text-ink">{pin.rating.toFixed(1)}</span>
                        </>
                      )}
                      {pin.rating != null && pin.city && <span className="opacity-50">·</span>}
                      {pin.city && <span className="truncate">{pin.city}</span>}
                    </span>
                  </span>
                </span>

                <span className="mt-2 flex items-center gap-1.5">
                  <AvatarStack recommenders={pin.recommenders} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-places-purple">{recommendersLabel(pin)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
