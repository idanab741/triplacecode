"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { optimizeImage } from "@/utils/imageUrl";
import type React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import type { FriendsMapPin, FriendsMapContribution } from "@/services/social/friendsMapService";
import { getFriendPinIcon } from "./friendPin";
import { ShareToFriendsSheet } from "./ShareToFriendsSheet";
import { TripMatchCategoryChips } from "@/screens/tripmatch/TripMatchCategoryChips";
import { SelectionActionBar } from "@/screens/collections/SelectionActionBar";
import type { HomeQuickCategoryId } from "@/constants/homeQuickCategories";

type Filter = "all" | "friends" | "mine";
type LatLng = { lat: number; lng: number };

const FILTERS: { id: Filter; label: string }[] = [
  // "כולם" (ולא "הכל") - כדי לא להתבלבל עם "הכל" של שורת סוגי המקומות.
  { id: "all", label: "כולם" },
  { id: "friends", label: "חברים" },
  { id: "mine", label: "שלי" },
];

/** צל "צף" אחיד ועדין לכל מה שיושב מעל המפה - ניטרלי (לא סגלגל) וצמוד, במקום ההילות הכבדות.
 *  (בקשה מפורשת - "המפה נראית חיוורת ומרושלת"). */
const FLOAT = "shadow-[0_1px_2px_rgba(15,20,25,0.10),0_6px_16px_-6px_rgba(15,20,25,0.22)]";

/** טקסט חד יותר בתוך המפה - כמו בעמוד הבית (ר' HOME_INK ב-PlacesFeedClient). */
const MAP_INK = { "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as React.CSSProperties;

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
    map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [44, 185], paddingBottomRight: [44, 320], maxZoom: 15, animate: false });
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

/** *** בקשה מפורשת ("שהכפתורים ייעלמו ויחזרו"): בזמן שהמשתמש גורר/מגדיל את המפה - שורת הסינון,
 *  הכרטיסים והכפתורים שלמטה נעלמים, וחוזרים לבד רגע אחרי שהוא עוזב. רק מחוות של המשתמש -
 *  תזוזה יזומה (fitBounds / flyTo לכרטיס שנבחר) לא מעלימה אותם. */
const CONTROLS_RETURN_MS = 700;

function ControlsAutoHide({ onHiddenChange }: { onHiddenChange: (hidden: boolean) => void }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    let pointersDown = 0;
    let moving = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const hide = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      moving = true;
      onHiddenChange(true);
    };
    const scheduleShow = () => {
      if (!moving || pointersDown > 0) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        moving = false;
        onHiddenChange(false);
      }, CONTROLS_RETURN_MS);
    };
    const onDown = () => {
      pointersDown += 1;
    };
    const onUp = () => {
      pointersDown = Math.max(0, pointersDown - 1);
      scheduleShow();
    };
    // צביטה/זום של המשתמש (אצבעות על המפה) - לא זום של flyTo.
    const onZoomStart = () => {
      if (pointersDown > 0) hide();
    };
    container.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    map.on("dragstart", hide);
    map.on("zoomstart", onZoomStart);
    map.on("moveend", scheduleShow);
    return () => {
      if (timer) clearTimeout(timer);
      container.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      map.off("dragstart", hide);
      map.off("zoomstart", onZoomStart);
      map.off("moveend", scheduleShow);
    };
  }, [map, onHiddenChange]);
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
  if (others.length === 0) return "שיתפת את המקום";
  const first = others[0].name;
  const extra = pin.recommendersCount - 1;
  if (extra <= 0) return `${first} שיתף/ה`;
  return pin.hasSelf && pin.recommendersCount === 2 ? `${first} ואת/ה שיתפתם` : `${first} ועוד ${extra} שיתפו`;
}

const KIND_LABEL: Record<FriendsMapContribution["kind"], string> = {
  added: "העלה/תה את המקום",
  review: "ביקורת",
  post: "פוסט",
  trip: "הוסיף/ה לטיול",
  collection: "הוסיף/ה לאוסף",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "עכשיו";
  if (min < 60) return `לפני ${min} דק'`;
  const h = Math.round(min / 60);
  if (h < 24) return `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? "אתמול" : `לפני ${d} ימים`;
  const m = Math.round(d / 30);
  if (m < 12) return m === 1 ? "לפני חודש" : `לפני ${m} חודשים`;
  const y = Math.round(m / 12);
  return y === 1 ? "לפני שנה" : `לפני ${y} שנים`;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-[12px] leading-none tracking-tight" aria-label={`דירוג ${value} מתוך 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(value) ? "text-[#F59E0B]" : "text-black/15"}>
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * *** חדש (בקשה מפורשת - "בתוך המקום המאוחד להכניס את כל מה שהמשתמשים מעלים,
 * עם תמונות של המשתמש שהעלה/דירג"): גיליון תחתון עם כל התרומות לאותו מקום -
 * לכל משתמש: אווטאר, שם, סוג (העלאה / ביקורת / פוסט), דירוג, טקסט והתמונות שהוא
 * העלה. לחיצה על תמונה פותחת אותה במסך מלא.
 */
function PlaceContributionsSheet({
  pin,
  onClose,
  onOpenPlace,
}: {
  pin: FriendsMapPin;
  onClose: () => void;
  onOpenPlace: () => void;
}) {
  const [viewer, setViewer] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const rating = pin.userRatingAvg ?? pin.rating;
  /** פוסט לגיבוי - אם מסיבה כלשהי המקום לא נמצא באף מאגר, נשלח הפוסט האחרון עליו. */
  const fallbackPostId = pin.contributions.find((c) => c.id.startsWith("post:"))?.id.slice("post:".length);

  return (
    <div className="absolute inset-0 z-[1200] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={pin.name}>
      <button type="button" aria-label="סגור" onClick={onClose} className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" />
      <div className="relative flex max-h-[78%] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-18px_40px_-20px_rgba(20,10,60,0.6)]">
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-black/10" />
        <div className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[18px] font-extrabold text-ink">{pin.name}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-ink-secondary">
              {rating != null && (
                <>
                  <span className="text-[#F59E0B]">★</span>
                  <span className="font-semibold text-ink">{rating.toFixed(1)}</span>
                  {pin.userRatingAvg != null && <span>({pin.userRatingCount})</span>}
                </>
              )}
              {rating != null && pin.city && <span className="opacity-50">·</span>}
              {pin.city && <span className="truncate">{pin.city}</span>}
            </p>
            <p className="mt-1 text-[12.5px] font-bold text-places-purple">
              {pin.recommendersCount === 1 ? "משתמש אחד שיתף" : `${pin.recommendersCount} משתמשים שיתפו`}
            </p>
          </div>
          {/* *** בקשה מפורשת ("אפשרות לשלוח מקום לחברים באפליקציה ולשתף - בחלונית המקום") */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              aria-label={`שליחת ${pin.name} לחברים`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1EDFB] text-places-purple transition active:scale-95"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21.5 2.5 10.5 13.5M21.5 2.5l-7 19-4-8-8-4 19-7z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onOpenPlace}
              className="rounded-full bg-places-purple px-4 py-2 text-[13px] font-semibold text-white transition active:scale-95"
            >
              לעמוד המקום
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-black/[0.06] pb-6">
          {pin.contributions.map((c) => (
            <div key={c.id} className="border-b border-black/[0.05] px-5 py-3.5 last:border-b-0">
              <div className="flex items-center gap-2.5">
                {/* לחיצה על האווטאר/השם מובילה לפרופיל של המשתמש */}
                <Link
                  href={`/places/profile/${c.username ?? c.userId}`}
                  aria-label={`לפרופיל של ${c.name}`}
                  className="flex min-w-0 flex-1 items-center gap-2.5 transition active:opacity-70"
                >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getAvatarUrl(c.avatarUrl)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-black/5" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-extrabold text-ink">
                    {c.name}
                    {c.isSelf && <span className="font-semibold text-ink-secondary"> (את/ה)</span>}
                    {!c.isSelf && c.isFriend && <span className="font-semibold text-places-purple"> · חבר/ה</span>}
                  </p>
                  <p className="truncate text-[12px] text-ink-secondary">
                    {KIND_LABEL[c.kind]} · {timeAgo(c.createdAt)}
                  </p>
                </div>
                </Link>
                {c.rating != null && <Stars value={c.rating} />}
              </div>

              {c.text && <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink">{c.text}</p>}

              {c.photos.length > 0 && (
                <div className="stories-rail-track -mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5" style={{ scrollbarWidth: "none" }}>
                  {c.photos.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setViewer(url)}
                      className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-places-bg transition active:scale-[0.97]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={optimizeImage(url, 112, { height: 112 })} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {shareOpen && (
        <ShareToFriendsSheet
          options={[{ label: "המקום", target: { kind: "place", id: pin.placeId, fallbackPostId } }]}
          externalShareTitle={pin.name}
          onClose={() => setShareOpen(false)}
        />
      )}

      {viewer && (
        <button
          type="button"
          aria-label="סגור תמונה"
          onClick={() => setViewer(null)}
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={optimizeImage(viewer, 720, { quality: 80, resize: "contain" })} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
        </button>
      )}
    </div>
  );
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
  // סינון לפי סוג מקום (אטרקציות / אוכל / ...) - בחירה מרובה, ריק = הכל. אותה שורה כמו בעמוד ההחלקות.
  const [categories, setCategories] = useState<HomeQuickCategoryId[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [fly, setFly] = useState<{ key: string; n: number } | null>(null);
  const [locateToken, setLocateToken] = useState(0);
  const [controlsHidden, setControlsHidden] = useState(false);
  // *** בחירה מרובה (בקשה מפורשת - "ללחוץ על כמה נעצים במפה ואז ליצור אוסף חדש / מסלול"): במצב הזה
  // לחיצה על נעץ או כרטיס מסמנת/מבטלת אותו, ובתחתית מופיע בר "אוסף חדש / מסלול חדש".
  const [selecting, setSelecting] = useState(false);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  function toggleChecked(key: string) {
    setCheckedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }
  function exitSelecting() {
    setSelecting(false);
    setCheckedKeys([]);
  }
  // מעבר רך להעלמה/חזרה של הפקדים שמעל המפה (ר' ControlsAutoHide).
  const controlsStyle = (shiftY: number): React.CSSProperties => ({
    opacity: controlsHidden ? 0 : 1,
    transform: controlsHidden ? `translateY(${shiftY}px)` : "none",
    pointerEvents: controlsHidden ? "none" : undefined,
    transition: "opacity 220ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1), top 320ms cubic-bezier(0.22, 1, 0.36, 1)",
  });
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
    let list = pins;
    if (filter === "friends") list = list.filter((p) => p.hasFriend);
    else if (filter === "mine") list = list.filter((p) => p.hasSelf);
    if (categories.length > 0) list = list.filter((p) => p.category != null && categories.includes(p.category as HomeQuickCategoryId));
    return list;
  }, [pins, filter, categories]);

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
  const sheetPin = sheetKey ? (pins ?? []).find((p) => p.key === sheetKey) ?? null : null;

  return (
    // *** תיקון (בקשה מפורשת - "המפה צריכה להיות בגוונים ובעיצוב שלנו, כמו מפת עמוד הבית"):
    // אותו סגנון בסיס בדיוק כמו מפת הבית (MapTiler DATAVIZ, ובגיבוי OSM עם map-branded) -
    // ברור וקריא, בלי הפילטר שעימעם. הגוון של place's בא ממעטפת סגולה עדינה מעל האריחים
    // (רק 7% - לא פוגעת בקריאות), מהנעצים, מהכרטיסים ומהבקרים.
    <div
      style={MAP_INK}
      className={`places-friends-map relative isolate z-0 h-full w-full overflow-hidden bg-[#F2F0EB] ${
        IS_USING_FALLBACK_TILES ? "map-branded" : ""
      }`}
      onPointerDownCapture={() => onInteractingChange?.(true)}
      onPointerUpCapture={() => onInteractingChange?.(false)}
      onPointerCancelCapture={() => onInteractingChange?.(false)}
    >
      {pins === null ? (
        <div className="absolute inset-0 animate-pulse bg-[#F2F0EB]" />
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
            <MapTilerBaseLayer refined />
          )}

          {filtered.map((pin) => (
            <Marker
              key={pin.key}
              position={[pin.latitude, pin.longitude]}
              icon={getFriendPinIcon({
                photoUrl: pin.imageUrl,
                count: pin.recommendersCount,
                selected: !selecting && pin.key === activeKey,
                checked: selecting && checkedKeys.includes(pin.key),
              })}
              zIndexOffset={pin.key === activeKey || (selecting && checkedKeys.includes(pin.key)) ? 1000 : 0}
              eventHandlers={{ click: () => (selecting ? toggleChecked(pin.key) : handlePinTap(pin.key)) }}
            />
          ))}

          {userLoc && <Marker position={[userLoc.lat, userLoc.lng]} icon={USER_ICON} zIndexOffset={-500} />}
          <ControlsAutoHide onHiddenChange={setControlsHidden} />
          <MapController pins={filtered} userLoc={userLoc} fitToken={fitToken} fly={fly} locateToken={locateToken} />
        </MapContainer>
      )}

      {/* *** הוסר: המעטפת הסגולה (7%) שישבה מעל כל המפה *וגם מעל הנעצים* - היא זו שנתנה את
          המראה החיוור. הגוון של place's מגיע עכשיו מהנעצים והבקרים בלבד. במקומה: דעיכה לבנה
          עדינה רק בראש המפה, כדי שהלוגו והכפתורים יהיו קריאים בלי עיגולים וצללים כבדים. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[500] h-44"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.6) 45%, rgba(255,255,255,0) 100%)" }}
      />

      {/* *** בקשה מפורשת: "כולם / חברים / שלי" + כפתור המיקום שלי - למטה, מתחת לפס הכרטיסים
          (מעל הבר התחתון). inset-x-5 = אותם שוליים כמו שורת הכותרת. */}
      {selecting ? (
        <SelectionActionBar
          selectedIds={(pins ?? []).filter((p) => checkedKeys.includes(p.key)).map((p) => p.placeId)}
          onCancel={exitSelecting}
          accent="var(--color-places-purple)"
          className="absolute inset-x-3 z-[1000]"
          style={{ bottom: "calc(var(--map-bottom-inset, 0px) + 8px)", ...controlsStyle(16) }}
        />
      ) : (
      <div
        className="absolute inset-x-5 z-[1000] flex items-center justify-between"
        style={{ bottom: "calc(var(--map-bottom-inset, 0px) + 12px)", ...controlsStyle(16) }}
      >
        <div className={`flex rounded-full bg-white p-1 ring-1 ring-black/[0.06] ${FLOAT}`} role="tablist" aria-label="סינון המלצות">
          {FILTERS.map((f) => {
            const selected = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-4 py-1.5 text-[13px] transition-colors ${
                  selected ? "bg-places-purple font-semibold text-white" : "font-medium text-ink active:bg-black/[0.05]"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSelecting(true)}
          disabled={filtered.length === 0}
          className={`flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold text-ink ring-1 ring-black/[0.06] transition active:scale-95 disabled:opacity-50 ${FLOAT}`}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
            <path d="m8 12.3 2.8 2.8L16 9.6" />
          </svg>
          בחירה
        </button>
        <button
          type="button"
          onClick={handleLocate}
          aria-label="המיקום שלי"
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink ring-1 ring-black/[0.06] transition active:scale-95 ${FLOAT}`}
        >
          {/* חץ ניווט - הסמל המוכר של "המיקום שלי" (Apple/Google Maps) */}
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" style={{ transform: "translate(-1px, 1px)" }}>
            <path d="M20.5 3.5 3.8 10.4c-.8.3-.7 1.4.1 1.6l6.6 1.5 1.5 6.6c.2.8 1.3.9 1.6.1Z" />
          </svg>
        </button>
        </span>
      </div>
      )}

      {/* שורת הסינון לפי סוג מקום - אותה שורה כמו בעמוד ההחלקות, בגרסה צפה (לבנה עם צל) מעל המפה
          ובסגול של place's. יושבת ישר מתחת ללוגו. */}
      <div
        className="absolute inset-x-0 z-[1000]"
        style={{ top: topOffsetPx, ...controlsStyle(-12) }}
      >
        <TripMatchCategoryChips
          selected={categories}
          onToggle={(id) => setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))}
          onClear={() => setCategories([])}
          accent="var(--color-places-purple)"
          surface="floating"
          className="px-5 pb-3 pt-1"
        />
      </div>

      {/* מצב ריק / שגיאה */}
      {isEmpty && (
        <div className={`absolute inset-x-6 top-1/2 z-[1000] -translate-y-[60%] rounded-3xl bg-white p-6 text-center ring-1 ring-black/[0.06] ${FLOAT}`}>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-places-bg text-places-purple">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
          <p className="mt-3 text-[16px] font-extrabold text-ink">
            {error ? "לא הצלחנו לטעון את המפה" : categories.length > 0 && (pins?.length ?? 0) > 0 ? "אין כאן מקומות מהסוג הזה" : filter === "mine" ? "עוד אין לכם מקומות על המפה" : filter === "friends" ? "לחברים שלכם עוד אין מקומות על המפה" : "אין עדיין מקומות על המפה"}
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-secondary">
            {error
              ? "נסו שוב בעוד רגע."
              : "מקומות שיועלו, יקבלו ביקורת, יפורסמו בפוסט או יתווספו לטיול או לאוסף יופיעו כאן על המפה."}
          </p>
          {!error && onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="h-12 rounded-xl text-[15.5px] font-semibold mt-4 bg-places-purple px-6 text-white transition active:scale-95"
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
          className="stories-rail-track absolute inset-x-0 z-[1000] flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-3 pt-2"
          style={{ scrollbarWidth: "none", bottom: `calc(var(--map-bottom-inset, 0px) + ${selecting ? 70 : 56}px)`, ...controlsStyle(24) }}
        >
          {filtered.map((pin) => {
            const selected = pin.key === activeKey;
            const checked = checkedKeys.includes(pin.key);
            return (
              <button
                key={pin.key}
                ref={(el) => {
                  if (el) cardRefs.current.set(pin.key, el);
                  else cardRefs.current.delete(pin.key);
                }}
                type="button"
                onClick={() => {
                  if (selecting) {
                    toggleChecked(pin.key);
                    return;
                  }
                  selectByUser(pin.key);
                  setSheetKey(pin.key);
                }}
                aria-pressed={selecting ? checked : undefined}
                className={`relative w-[72%] max-w-[280px] shrink-0 snap-center rounded-[18px] bg-white p-2.5 text-start transition-shadow duration-200 ${FLOAT} ${
                  (selecting ? checked : selected) ? "ring-2 ring-places-purple" : "ring-1 ring-black/[0.06]"
                }`}
              >
                {selecting && (
                  <span
                    aria-hidden="true"
                    className={`absolute end-2.5 top-2.5 z-[1] flex h-6 w-6 items-center justify-center rounded-full ${
                      checked ? "bg-places-purple text-white" : "bg-white text-transparent ring-2 ring-black/15"
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                )}
                <span className="flex items-center gap-2.5">
                  {pin.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={optimizeImage(pin.imageUrl, 56, { height: 56 })} alt="" loading="lazy" decoding="async" draggable={false} className="h-14 w-14 shrink-0 rounded-[12px] object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] bg-places-bg text-places-purple">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
                        <circle cx="12" cy="10" r="2.5" />
                      </svg>
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold leading-tight text-ink">{pin.name}</span>
                    <span className="mt-1 flex items-center gap-1 truncate text-[13px] text-ink-secondary">
                      {(pin.userRatingAvg ?? pin.rating) != null && (
                        <>
                          <span className="text-[#F59E0B]">★</span>
                          <span className="font-semibold text-ink">{(pin.userRatingAvg ?? pin.rating)!.toFixed(1)}</span>
                        </>
                      )}
                      {(pin.userRatingAvg ?? pin.rating) != null && pin.city && <span className="opacity-50">·</span>}
                      {pin.city && <span className="truncate">{pin.city}</span>}
                    </span>
                  </span>
                </span>

                <span className="mt-2 flex items-center gap-1.5 border-t border-black/[0.06] pt-2">
                  <AvatarStack recommenders={pin.recommenders} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink-secondary">{recommendersLabel(pin)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {sheetPin && (
        <PlaceContributionsSheet
          pin={sheetPin}
          onClose={() => setSheetKey(null)}
          onOpenPlace={() => router.push(`/place/${sheetPin.placeId}`)}
        />
      )}
    </div>
  );
}
