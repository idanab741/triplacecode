"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { getSavedPlaceItems, removeSavedPlace, restoreSavedPlace, type SavedPlaceItem } from "@/services/favorites/favoritesService";
import { Screen, Skeleton, SwipeActionsRow, type SwipeAction } from "@/components/ui";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { MainBottomNav } from "@/components/MainBottomNav";
import { RetentionInfoModal } from "@/screens/trips/RetentionInfoModal";
import { AddToCalendarSheet, type CalendarItemRef } from "@/screens/calendar/AddToCalendarSheet";
import { getDaysRemainingBeforeRemoval } from "@/constants/contentRetention";
import { HOME_QUICK_CATEGORIES, type HomeQuickCategoryId } from "@/constants/homeQuickCategories";
import { TRIP_TYPE_SHORT_LABEL, tripTypeIconSrc, tripTypeOfItem } from "@/constants/tripTypeOfItem";
import { SelectionActionBar } from "@/screens/collections/SelectionActionBar";
import { AddToSheet } from "@/screens/collections/AddToSheet";

/**
 * *** בנוי מחדש (בקשה מפורשת - "יש המון כפתורי שמירה באפליקציה - צריך לסדר את זה כאן, כולל פוסטים
 * וכולל החלקות ימינה"): כל מה שנשמר בכל מקום באפליקציה, במקום אחד, מהחדש לישן:
 *  - מקומות: "שמירה" (עמוד אטרקציה / חיפוש / מפה) + החלקה ימינה ב-TripMatch (עם תג tripmatch).
 *  - פוסטים, טיולים ואוספים של הקהילה (social_saves - קודם לא הופיעו כאן בכלל).
 *  - "מסלולים שבניתי" - מסלולים זמניים שנבנו באפליקציה (לשונית נפרדת, מופיעה רק אם יש).
 * "שמור" = בלי תאריך. לכל מקום/טיול יש כפתור "ליומן" שנותן לו תאריך.
 * *** Trippy AI הושהה (בקשה מפורשת): תוצאות Trippy AI לא מוצגות (הנתונים לא נמחקים - SHOW_TRIPPY_AI).
 */
const SHOW_TRIPPY_AI = false;

const BLUE = "#0A6DFE";
const INK = { "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties;

type Filter = "all" | "places" | "posts" | "trips" | "collections" | "built";

interface SocialItem {
  kind: "post" | "trip" | "collection";
  id: string;
  savedAt: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  href: string;
  tripType: string | null;
}

interface BuiltTrip {
  id: string;
  tripType: string;
  title: string;
  imageUrl: string | null;
  stopCount: number;
  createdAt: string;
  isSaved: boolean;
}

type Row =
  | { key: string; kind: "place"; savedAt: string; item: SavedPlaceItem; tripType: HomeQuickCategoryId }
  | { key: string; kind: "post" | "trip" | "collection"; savedAt: string; item: SocialItem };

const TRIP_TYPE_ROUTE: Record<string, string> = {
  abroad_vacation: "abroad-vacation",
  day_trip: "day-trip",
  romantic_date: "romantic-date",
  nightlife: "nightlife",
};

const RETENTION_POPUP_SEEN_KEY = "trips_retention_popup_seen_v1";

const ip = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const Icons = {
  all: (
    <svg {...ip}>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.5L5.5 21V4.5a1 1 0 0 1 1-1z" />
    </svg>
  ),
  places: (
    <svg {...ip}>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  ),
  posts: (
    <svg {...ip}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <circle cx="9" cy="9" r="1.6" />
      <path d="m20.5 15.5-5-5-9 9" />
    </svg>
  ),
  trips: (
    <svg {...ip}>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
    </svg>
  ),
  collections: (
    <svg {...ip}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  ),
  built: (
    <svg {...ip}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" />
    </svg>
  ),
  calendar: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  ),
  bookmarkFilled: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.5L5.5 21V4.5a1 1 0 0 1 1-1z" />
    </svg>
  ),
  trash: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  ),
};

const KIND_LABEL: Record<Row["kind"], string> = { place: "מקום", post: "פוסט", trip: "טיול", collection: "מפה" };

function socialSavePath(kind: "post" | "trip" | "collection", id: string): string {
  return `/api/social/${kind === "post" ? "posts" : kind === "trip" ? "trips" : "collections"}/${id}/save`;
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("he-IL", { day: "numeric", month: "long" });
}

const ADD_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/** שורה ברשימה: תמונה (עם אייקון סוג הטיול למקומות), כותרת ושורת מידע.
 *  *** בקשה מפורשת ("שיטת החלקות - ימינה מחיקה, שמאלה יומן והוספה לאוסף"): בלי כפתורים בשורה -
 *  החלקה ימינה = הסרה מהבחירות, החלקה שמאלה = יומן / הוספה ל... (או לחיצה ארוכה). */
function SavedRow({
  imageUrl,
  fallback,
  typeIcon,
  title,
  meta,
  badge,
  onOpen,
  onCalendar,
  onAddTo,
  onRemove,
  selection,
}: {
  imageUrl: string | null;
  fallback: ReactNode;
  typeIcon?: string;
  title: string;
  meta: string;
  badge?: string;
  onOpen: () => void;
  onCalendar?: () => void;
  /** "הוספה ל..." - מפה / טיול (רק למקומות) */
  onAddTo?: () => void;
  onRemove: () => void;
  /** בחירה מרובה: במקום כפתורי היומן/ההסרה - עיגול סימון, והלחיצה על השורה מסמנת. */
  selection?: { checked: boolean };
}) {
  const actions: SwipeAction[] = [
    ...(onCalendar ? [{ key: "calendar", label: "יומן", icon: Icons.calendar, color: BLUE, onClick: onCalendar }] : []),
    ...(onAddTo ? [{ key: "add", label: "הוספה ל...", icon: ADD_ICON, color: "#7C3AED", onClick: onAddTo }] : []),
  ];
  return (
    <SwipeActionsRow onDelete={onRemove} actions={actions} disabled={!!selection} className="-mx-2 rounded-2xl">
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()} className="flex cursor-pointer items-center gap-3.5 px-2 py-2.5 transition-colors active:bg-black/[0.04]">
      <span className="relative shrink-0">
        <span className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-xl bg-[#F1F2F5] text-ink-secondary">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            fallback
          )}
        </span>
        {typeIcon && (
          <span className="absolute -bottom-1.5 -start-1.5 block h-7 w-7 overflow-hidden rounded-full bg-white ring-2 ring-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={typeIcon} alt="" className="h-full w-full scale-125 object-cover" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[15.5px] font-semibold leading-snug text-ink">{title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-secondary">
          <span className="truncate">{meta}</span>
          {badge && <span className="shrink-0 rounded-full bg-[#F1EDFB] px-2 py-0.5 text-[11.5px] font-semibold text-places-purple">{badge}</span>}
        </span>
      </span>
      {selection ? (
        <span
          aria-hidden="true"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
            selection.checked ? "text-white" : "bg-white text-transparent ring-2 ring-black/15"
          }`}
          style={selection.checked ? { background: BLUE } : undefined}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
      ) : null}
    </div>
    </SwipeActionsRow>
  );
}

export default function TripsPage() {
  return (
    <Suspense>
      <MyPicksContent />
    </Suspense>
  );
}

function MyPicksContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [filter, setFilter] = useState<Filter>("all");
  const [typeFilter, setTypeFilter] = useState<HomeQuickCategoryId | null>(null);
  const [places, setPlaces] = useState<SavedPlaceItem[] | null>(null);
  const [social, setSocial] = useState<SocialItem[] | null>(null);
  const [built, setBuilt] = useState<BuiltTrip[] | null>(null);
  const [calendarItem, setCalendarItem] = useState<CalendarItemRef | null>(null);
  const [addToItem, setAddToItem] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<{ text: string; actionLabel?: string; action?: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRetentionInfo, setShowRetentionInfo] = useState(false);
  // *** בחירה מרובה (בקשה מפורשת - "לבחור כמה אטרקציות ואז ליצור אוסף חדש / מסלול"): רק מקומות.
  const [selecting, setSelecting] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  function toggleChecked(id: string) {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  useEffect(() => {
    if (!user) return;
    getSavedPlaceItems(user.id)
      .then(setPlaces)
      .catch(() => setPlaces([]));
    fetch("/api/me/saved")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: SocialItem[] }) => setSocial(d.items ?? []))
      .catch(() => setSocial([]));
    Promise.all([
      fetch("/api/trip-builder/sessions/saved?all=true")
        .then((r) => r.json())
        .catch(() => ({ trips: [] })),
      SHOW_TRIPPY_AI
        ? fetch("/api/trippy-ai?all=true")
            .then((r) => r.json())
            .catch(() => ({ results: [] }))
        : Promise.resolve({ results: [] }),
    ]).then(([sessions]) => {
      setBuilt(
        ((sessions.trips ?? []) as { sessionId: string; tripType: string; destinationLabel: string; imageUrl: string | null; stopCount: number; createdAt: string; isSaved?: boolean }[]).map((t) => ({
          id: t.sessionId,
          tripType: t.tripType,
          title: t.destinationLabel,
          imageUrl: t.imageUrl,
          stopCount: t.stopCount,
          createdAt: t.createdAt,
          isSaved: t.isSaved === true,
        }))
      );
    });
  }, [user]);

  useEffect(() => {
    if (filter !== "built" || built === null || typeof window === "undefined") return;
    if (window.localStorage.getItem(RETENTION_POPUP_SEEN_KEY)) return;
    setShowRetentionInfo(true);
  }, [filter, built]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  function showToast(next: { text: string; actionLabel?: string; action?: () => void }) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  const rows: Row[] = useMemo(() => {
    const placeRows: Row[] = (places ?? []).map((item) => ({
      key: `place:${item.place.id}`,
      kind: "place",
      savedAt: item.savedAt,
      item,
      tripType: tripTypeOfItem(item.place.category, item.place.subcategory),
    }));
    const socialRows: Row[] = (social ?? []).map((item) => ({ key: `${item.kind}:${item.id}`, kind: item.kind, savedAt: item.savedAt, item }));
    return [...placeRows, ...socialRows].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }, [places, social]);

  const counts = {
    all: rows.length,
    places: rows.filter((r) => r.kind === "place").length,
    posts: rows.filter((r) => r.kind === "post").length,
    trips: rows.filter((r) => r.kind === "trip").length,
    collections: rows.filter((r) => r.kind === "collection").length,
    built: built?.length ?? 0,
  };

  const typeCounts = useMemo(() => {
    const m = new Map<HomeQuickCategoryId, number>();
    for (const r of rows) if (r.kind === "place") m.set(r.tripType, (m.get(r.tripType) ?? 0) + 1);
    return m;
  }, [rows]);

  const visible = rows.filter((r) => {
    if (filter === "places") return r.kind === "place" && (!typeFilter || r.tripType === typeFilter);
    if (filter === "posts") return r.kind === "post";
    if (filter === "trips") return r.kind === "trip";
    if (filter === "collections") return r.kind === "collection";
    return filter === "all";
  });

  const filters: { id: Filter; label: string; icon: ReactNode }[] = [
    { id: "all", label: "הכל", icon: Icons.all },
    { id: "posts", label: "פוסטים", icon: Icons.posts },
    { id: "places", label: "מקומות", icon: Icons.places },
    { id: "collections", label: "מפות", icon: Icons.collections },
    { id: "trips", label: "טיולים", icon: Icons.trips },
    ...(counts.built > 0 ? [{ id: "built" as const, label: "מסלולים שבניתי", icon: Icons.built }] : []),
  ];

  async function removePlace(item: SavedPlaceItem) {
    if (!user) return;
    setPlaces((prev) => (prev ? prev.filter((p) => p.place.id !== item.place.id) : prev));
    const supabase = createClient();
    await removeSavedPlace(supabase, user.id, item.place.id, item.placeType).catch(() => {});
    showToast({
      text: "הוסר מהבחירות",
      actionLabel: "ביטול",
      action: async () => {
        setToast(null);
        setPlaces((prev) => (prev ? [item, ...prev.filter((p) => p.place.id !== item.place.id)] : [item]));
        await restoreSavedPlace(supabase, user.id, item.place.id, item.placeType, item.fromTripmatch).catch(() => {});
      },
    });
  }

  async function removeSocial(item: SocialItem) {
    setSocial((prev) => (prev ? prev.filter((s) => !(s.kind === item.kind && s.id === item.id)) : prev));
    await fetch(socialSavePath(item.kind, item.id), { method: "POST" }).catch(() => {});
    showToast({
      text: "הוסר מהבחירות",
      actionLabel: "ביטול",
      action: async () => {
        setToast(null);
        setSocial((prev) => (prev ? [item, ...prev] : [item]));
        await fetch(socialSavePath(item.kind, item.id), { method: "POST" }).catch(() => {});
      },
    });
  }

  // החלקה ימינה + לחיצה על "מחיקה" = אישור מספיק (שני צעדים), אין צורך בלחיצה נוספת
  async function deleteBuiltNow(trip: BuiltTrip) {
    setBuilt((prev) => (prev ? prev.filter((t) => t.id !== trip.id) : prev));
    await fetch(`/api/trip-builder/sessions/${trip.id}`, { method: "DELETE" }).catch(() => {});
    showToast({ text: "המסלול נמחק" });
  }

  const unsavedBuilt = (built ?? []).filter((t) => !t.isSaved);
  const nearestExpiringDays = unsavedBuilt.length > 0 ? Math.min(...unsavedBuilt.map((t) => getDaysRemainingBeforeRemoval(t.createdAt))) : null;
  const isLoading = loading || places === null || social === null;

  const emptyText: Record<Filter, string> = {
    all: "עוד לא שמרתם כלום. לחצו על שמירה בכל מקום, פוסט או טיול שאהבתם, והם יחכו לכם כאן.",
    places: typeFilter ? `אין מקומות שמורים מסוג ${TRIP_TYPE_SHORT_LABEL[typeFilter]}.` : "עוד לא שמרתם מקומות. גם החלקה ימינה ב-tripmatch שומרת כאן.",
    posts: "עוד לא שמרתם פוסטים.",
    trips: "עוד לא שמרתם טיולים של הקהילה.",
    collections: "עוד לא שמרתם מפות.",
    built: "אין מסלולים שבניתם.",
  };

  return (
    <Screen withBottomNavSpacing className="!bg-white !px-0 !pt-0">
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => router.push("/profile")} />

      <div className={`mx-auto max-w-xl ${selecting ? "pb-28" : "pb-6"}`} style={INK}>
        <header className="px-5 pt-4">
          <div className="flex items-center justify-between gap-3">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">הבחירות שלי</h1>
          {!selecting && counts.places > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelecting(true);
                setFilter("places");
              }}
              aria-label="בחירה מרובה - יצירת מפה או טיול"
              title="בחירה מרובה"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F1F2F5] text-ink transition active:scale-95"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                <path d="m8 12.3 2.8 2.8L16 9.6" />
              </svg>
            </button>
          )}
          </div>
          <p className="mt-1 text-[14px] text-ink-secondary">כל מה ששמרתם, במקום אחד. החליקו שורה שמאלה ליומן או להוספה למפה, ימינה להסרה.</p>
        </header>

        {/* סינון לפי סוג */}
        <nav aria-label="סינון" hidden={selecting} className="flex gap-2 overflow-x-auto px-5 pb-1 pt-4" style={{ scrollbarWidth: "none" }}>
          {filters.map((f) => {
            const active = filter === f.id;
            const count = counts[f.id];
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilter(f.id);
                  setTypeFilter(null);
                }}
                aria-pressed={active}
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold transition active:scale-95 ${active ? "text-white" : "bg-[#F1F2F5] text-ink"}`}
                style={active ? { background: BLUE } : undefined}
              >
                {f.icon}
                {f.label}
                {!isLoading && count > 0 && <span className={`tabular-nums ${active ? "text-white/80" : "text-ink-secondary"}`}>{count}</span>}
              </button>
            );
          })}
        </nav>

        {/* במקומות: סינון נוסף לפי סוג טיול - אותם אייקונים של עמוד הבית */}
        {filter === "places" && typeCounts.size > 0 && (
          <div className="flex gap-1 overflow-x-auto px-5 pt-3" style={{ scrollbarWidth: "none" }}>
            {HOME_QUICK_CATEGORIES.filter((c) => typeCounts.has(c.id)).map((c) => {
              const active = typeFilter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTypeFilter(active ? null : c.id)}
                  aria-pressed={active}
                  className="flex w-[60px] shrink-0 flex-col items-center gap-1 transition active:scale-95"
                >
                  <span className="relative">
                    <span
                      className="block h-11 w-11 overflow-hidden rounded-full bg-[#F1F2F5]"
                      style={active ? { boxShadow: `0 0 0 2.5px #fff, 0 0 0 4.5px ${BLUE}` } : undefined}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.imageSrc} alt="" className="h-full w-full scale-125 object-cover" />
                    </span>
                    <span className="absolute -bottom-1 -start-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold text-white ring-2 ring-white tabular-nums" style={{ background: BLUE }}>
                      {typeCounts.get(c.id)}
                    </span>
                  </span>
                  <span className={`w-full truncate text-center text-[11.5px] ${active ? "font-bold text-ink" : "font-medium text-ink-secondary"}`}>{TRIP_TYPE_SHORT_LABEL[c.id]}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="px-5 pt-4">
          {filter === "built" ? (
            <>
              <p className="mb-2 rounded-xl bg-[#F4F5F7] px-3.5 py-3 text-[13.5px] leading-snug text-ink-secondary">
                מסלולים שבניתם באפליקציה. מסלול שלא שמרתם נמחק אוטומטית אחרי 14 יום.
              </p>
              {(built ?? []).map((trip) => {
                const days = trip.isSaved ? null : getDaysRemainingBeforeRemoval(trip.createdAt);
                const segment = TRIP_TYPE_ROUTE[trip.tripType] ?? trip.tripType.replace(/_/g, "-");
                return (
                  <SwipeActionsRow key={trip.id} onDelete={() => deleteBuiltNow(trip)} deleteLabel="מחיקה" className="-mx-2 rounded-2xl">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/trip-builder/${segment}/result?sessionId=${trip.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && router.push(`/trip-builder/${segment}/result?sessionId=${trip.id}`)}
                    className="flex cursor-pointer items-center gap-3.5 px-2 py-2.5 transition-colors active:bg-black/[0.04]"
                  >
                    <span className="flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F1F2F5] text-ink-secondary">
                      {trip.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={trip.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        Icons.trips
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[15.5px] font-semibold leading-snug text-ink">{trip.title}</span>
                      <span className="mt-0.5 block text-[13px] text-ink-secondary">
                        {trip.tripType === "tripmatch" ? "tripmatch · " : ""}
                        {trip.stopCount} תחנות
                      </span>
                      {days != null && (
                        <span className="mt-1 inline-block rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[11.5px] font-semibold" style={{ color: BLUE }}>
                          {days === 0 ? "נמחק היום - שמרו כדי לא לאבד" : `זמני · עוד ${days} ${days === 1 ? "יום" : "ימים"}`}
                        </span>
                      )}
                    </span>
                  </div>
                  </SwipeActionsRow>
                );
              })}
            </>
          ) : isLoading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3.5">
                  <Skeleton className="h-[76px] w-[76px] rounded-xl" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-4 px-4 py-14 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F1F2F5] text-ink-secondary">{Icons.all}</span>
              <p className="max-w-[300px] text-[15px] leading-relaxed text-ink-secondary">{emptyText[filter]}</p>
              <button
                type="button"
                onClick={() => router.push("/home")}
                className="h-12 rounded-xl px-8 text-[15.5px] font-semibold text-white transition active:scale-[0.98]"
                style={{ background: BLUE }}
              >
                לגלות מקומות
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              {visible.map((row) => {
                if (row.kind === "place") {
                  const p = row.item.place;
                  return (
                    <SavedRow
                      key={row.key}
                      imageUrl={p.imageUrls[0] ?? null}
                      fallback={Icons.places}
                      typeIcon={tripTypeIconSrc(row.tripType)}
                      title={p.name}
                      meta={[TRIP_TYPE_SHORT_LABEL[row.tripType], p.city, p.rating != null ? `★ ${p.rating.toFixed(1)}` : null].filter(Boolean).join(" · ")}
                      badge={row.item.fromTripmatch ? "tripmatch" : undefined}
                      onOpen={() =>
                        selecting
                          ? p.type !== "destination" && toggleChecked(p.id)
                          : router.push(p.type === "destination" ? `/destination/${p.id}` : `/place/${p.id}`)
                      }
                      onCalendar={
                        p.type === "destination"
                          ? undefined
                          : () => setCalendarItem({ itemType: "place", id: p.id, name: p.name, imageUrl: p.imageUrls[0] ?? null, category: p.category ?? p.subcategory })
                      }
                      onAddTo={p.type === "destination" ? undefined : () => setAddToItem({ id: p.id, name: p.name })}
                      onRemove={() => removePlace(row.item)}
                      selection={selecting && p.type !== "destination" ? { checked: checkedIds.includes(p.id) } : undefined}
                    />
                  );
                }
                const s = row.item;
                return (
                  <SavedRow
                    key={row.key}
                    imageUrl={s.imageUrl}
                    fallback={s.kind === "post" ? Icons.posts : s.kind === "trip" ? Icons.trips : Icons.collections}
                    typeIcon={s.kind === "trip" && s.tripType ? tripTypeIconSrc(tripTypeOfItem(s.tripType)) : undefined}
                    title={s.title}
                    meta={[KIND_LABEL[s.kind], s.subtitle].filter(Boolean).join(" · ")}
                    onOpen={() => router.push(s.href)}
                    onCalendar={s.kind === "trip" ? () => setCalendarItem({ itemType: "trip", id: s.id, name: s.title, imageUrl: s.imageUrl, category: s.tripType }) : undefined}
                    onRemove={() => removeSocial(s)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {addToItem && <AddToSheet ids={[addToItem.id]} label={addToItem.name} onClose={() => setAddToItem(null)} />}
      {calendarItem && (
        <AddToCalendarSheet
          item={calendarItem}
          onClose={() => setCalendarItem(null)}
          onDone={(r) => {
            setCalendarItem(null);
            if (r.action === "added" && r.date) showToast({ text: `נוסף ליומן · ${formatShortDate(r.date)}`, actionLabel: "ליומן", action: () => router.push("/calendar") });
          }}
        />
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-[104px] z-50 flex justify-center px-5" role="status">
          <div className="flex w-full max-w-md items-center gap-3 rounded-xl bg-[#0f1419] py-2 pe-2 ps-4 text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{toast.text}</span>
            {toast.action && (
              <button type="button" onClick={toast.action} className="h-9 shrink-0 rounded-lg px-3 text-[14.5px] font-bold text-[#6EA8FF] active:bg-white/10">
                {toast.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {showRetentionInfo && (
        <RetentionInfoModal
          nearestExpiringDays={nearestExpiringDays}
          onClose={() => {
            setShowRetentionInfo(false);
            window.localStorage.setItem(RETENTION_POPUP_SEEN_KEY, "true");
          }}
        />
      )}

      {selecting && (
        <SelectionActionBar
          selectedIds={checkedIds}
          onCancel={() => {
            setSelecting(false);
            setCheckedIds([]);
          }}
          className="fixed inset-x-3 z-[60] mx-auto max-w-xl"
          style={{ bottom: "calc(66px + max(env(safe-area-inset-bottom), 22px) + 10px)" }}
        />
      )}
      <MainBottomNav active="profile" />
    </Screen>
  );
}
