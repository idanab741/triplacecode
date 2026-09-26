"use client";

import { MainBottomNav } from "@/components/MainBottomNav";
import { use, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { PostInlineComments } from "@/screens/places/PostInlineComments";
import { CollectionActionBar } from "@/screens/collections/CollectionActionBar";
import { TripQuickAdd } from "@/screens/collections/QuickAdd";
import { AddToCalendarSheet } from "@/screens/calendar/AddToCalendarSheet";
import { getAvatarUrl } from "@/constants/avatar";
import { getPlaceCategoryLabel } from "@/constants/placeCategories";
import { optimizeImage } from "@/utils/imageUrl";
import { CREATE_INK } from "@/screens/create/CreateUi";
import { directionsUrl, journeyColor, type JourneyLine, type JourneyMarker } from "@/screens/journey/journeyUtils";
import {
  CalendarIcon,
  HeroIconButton,
  MediaTile,
  MoreIcon,
  NavigateIcon,
  PinSmallIcon,
  BackIcon,
  PRIMARY_LINK_CLASS,
} from "@/screens/journey/JourneyUi";
import { formatStopNumber, formatTripMeta, getTripTypeLabel, type TripDetailDto, type TripStopDto } from "@/services/social/tripTypes";

// המפה (Leaflet) משתמשת ב-window/DOM - נטענת רק בצד הלקוח.
const JourneyMap = dynamic(() => import("@/screens/journey/JourneyMap").then((m) => m.JourneyMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#EEF0EA]" />,
});

type MapDayFilter = "all" | number;

/**
 * *** עיצוב מחדש (בקשה מפורשת - "בסוף יצא עמוד עם מפה עם נעצים בכל המקומות של הטיול, עם תמונות
 * וסרטונים, מעוצב יפה", בקו העיצובי של האפליקציה, נגיש ומזמין):
 * מפה בראש העמוד (נעצים ממוספרים וקו מסלול בצבע של כל יום) -> גיליון שעולה עליה: כותרת, יוצר,
 * פעולות, "רגעים מהטיול" (התמונות של התחנות) -> המסלול כציר זמן (תחנה = מספר, הערה, תמונות,
 * ניווט) -> בר קבוע "יוצאים לדרך" (Google Maps עם כל התחנות של היום/הטיול).
 * המפה והרשימה מחוברות: לחיצה על נעץ גוללת לתחנה; "במפה" בתחנה מסמן אותה על המפה.
 * כל הנתונים הם אותם נתונים שכבר הגיעו מ-/api/social/trips/[id] - שום API לא השתנה.
 */
export default function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [trip, setTrip] = useState<TripDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  // הוספה מהירה של תחנות (TripQuickAdd) - טוענים מחדש את הטיול אחרי כל תחנה שנוספה
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  // אחרי פרסום (TripForm) מגיעים עם ?created=1 - הודעת הצלחה קצרה, ומנקים את הפרמטר מה-URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("created") === "1") {
      setJustCreated(true);
      window.history.replaceState(null, "", window.location.pathname);
      const timer = setTimeout(() => setJustCreated(false), 4000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/social/trips/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "שגיאה בטעינת הטיול");
        setTrip(data.trip as TripDetailDto);
      })
      .catch((err) => setError(err.message));
  }, [id, user, version]);

  async function handleDelete() {
    if (!window.confirm("למחוק את הטיול? הפעולה לא הפיכה.")) return;
    const res = await fetch(`/api/social/trips/${id}`, { method: "DELETE" });
    if (res.ok) router.replace("/home");
  }

  return (
    <div className="min-h-screen bg-white" style={CREATE_INK}>
      <HomeStatusBarTint />

      {justCreated && (
        <div role="status" className="fixed inset-x-4 bottom-48 z-[45] rounded-full bg-[#0f1419] px-4 py-3 text-center text-[14px] font-semibold text-white shadow-soft">
          יצרתם טיול! הנה הוא על המפה
        </div>
      )}

      {error ? (
        <div className="pt-6">
          <PlacesEmptyState title={error} actionLabel="חזרה" onAction={() => router.back()} />
        </div>
      ) : !trip ? (
        <TripSkeleton />
      ) : (
        <TripBody trip={trip} onBack={() => router.back()} onDelete={handleDelete} onChanged={() => setVersion((v) => v + 1)} />
      )}
      <MainBottomNav active="places" />
    </div>
  );
}

function TripSkeleton() {
  return (
    <div aria-busy="true" aria-label="טוען את הטיול">
      <div className="h-[46vh] min-h-[300px] animate-pulse bg-[#EEF0EA]" />
      <div className="relative -mt-6 rounded-t-[28px] bg-white px-5 pt-6">
        <div className="h-4 w-40 animate-pulse rounded bg-[#EFF1F4]" />
        <div className="mt-3 h-8 w-3/4 animate-pulse rounded-lg bg-[#EFF1F4]" />
        <div className="mt-5 flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-[#EFF1F4]" />
          <div className="h-4 w-32 animate-pulse rounded bg-[#EFF1F4]" />
        </div>
        <div className="mt-6 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 w-[120px] animate-pulse rounded-[18px] bg-[#EFF1F4]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function hasCoords(stop: TripStopDto): boolean {
  return stop.place.latitude != null && stop.place.longitude != null;
}

function TripBody({
  trip,
  onBack,
  onDelete,
  onChanged,
}: {
  trip: TripDetailDto;
  onBack: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const authorName = trip.author.fullName ?? trip.author.username ?? "מטייל";
  const profileHref = `/places/profile/${trip.author.username ?? trip.author.id}`;
  const apiBase = `/api/social/trips/${trip.id}`;

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapDay, setMapDay] = useState<MapDayFilter>("all");
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarAddedOn, setCalendarAddedOn] = useState<string | null>(null);

  // תחנות לפי יום, כל יום ממוין לפי הסדר שלו
  const dayNumbers = useMemo(() => [...new Set(trip.stops.map((s) => s.day))].sort((a, b) => a - b), [trip.stops]);
  const stopsByDay = useMemo(
    () => new Map<number, TripStopDto[]>(dayNumbers.map((day) => [day, trip.stops.filter((s) => s.day === day).sort((a, b) => a.position - b.position)])),
    [dayNumbers, trip.stops]
  );
  const orderedStops = useMemo(() => dayNumbers.flatMap((day) => stopsByDay.get(day) ?? []), [dayNumbers, stopsByDay]);
  const multiDay = dayNumbers.length > 1;
  const dayColor = (day: number) => journeyColor(dayNumbers.indexOf(day));

  const ratings = trip.stops.map((s) => s.place.rating).filter((r): r is number => r != null);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  // העיר הנפוצה ביותר בין התחנות - שורת ה"איפה" מעל הכותרת.
  const mainCity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of trip.stops) if (s.place.city) counts.set(s.place.city, (counts.get(s.place.city) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [trip.stops]);

  // ───────── המפה ─────────
  const visibleStops = useMemo(() => orderedStops.filter((s) => hasCoords(s) && (mapDay === "all" || s.day === mapDay)), [orderedStops, mapDay]);
  const markers = useMemo<JourneyMarker[]>(
    () =>
      visibleStops.map((s) => ({
        id: s.id,
        latitude: s.place.latitude as number,
        longitude: s.place.longitude as number,
        name: s.place.name,
        imageUrl: s.place.imageUrls[0] ?? null,
        label: String(s.position + 1),
        color: dayColor(s.day),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleStops, dayNumbers]
  );
  const lines = useMemo<JourneyLine[]>(
    () =>
      dayNumbers
        .filter((day) => mapDay === "all" || day === mapDay)
        .map((day) => ({
          id: `day-${day}`,
          color: dayColor(day),
          dashed: dayNumbers.indexOf(day) % 2 === 1,
          points: (stopsByDay.get(day) ?? []).filter(hasCoords).map((s) => ({ latitude: s.place.latitude as number, longitude: s.place.longitude as number })),
        }))
        .filter((l) => l.points.length > 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayNumbers, stopsByDay, mapDay]
  );
  const goUrl = directionsUrl(visibleStops.map((s) => ({ latitude: s.place.latitude as number, longitude: s.place.longitude as number })));

  function focusStopInList(stopId: string) {
    setSelectedStopId(stopId);
    document.getElementById(`stop-${stopId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function showStopOnMap(stop: TripStopDto) {
    if (mapDay !== "all" && mapDay !== stop.day) setMapDay("all");
    setSelectedStopId(stop.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ───────── "רגעים מהטיול": התמונות של התחנות, לפי סדר המסלול ─────────
  const moments = useMemo(() => {
    const list: { key: string; url: string; stop: TripStopDto }[] = [];
    for (const stop of orderedStops) {
      for (const url of stop.place.imageUrls.slice(0, 2)) {
        if (list.length >= 12) break;
        list.push({ key: `${stop.id}-${url}`, url, stop });
      }
    }
    return list;
  }, [orderedStops]);

  return (
    <>
      {/* ───── מפה ───── */}
      <div className="trip-hero-map relative h-[46vh] min-h-[300px] max-h-[460px] bg-[#EEF0EA]">
        <style>{`.trip-hero-map .leaflet-bottom{bottom:30px}`}</style>
        {markers.length > 0 ? (
          <JourneyMap
            markers={markers}
            lines={lines}
            selectedId={selectedStopId}
            onSelect={focusStopInList}
            className="h-full"
            padding={{ top: 90, right: 40, bottom: multiDay ? 110 : 70, left: 40 }}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center text-[14px] text-ink-secondary">
            אין נתוני מיקום לתחנות {mapDay === "all" ? "בטיול הזה" : "ביום הזה"}
          </div>
        )}

        {/* כפתורים עליונים. המפה עטופה ב-isolate (z-0), אז z-10 מספיק כדי לשבת מעליה. */}
        <div className="pointer-events-none absolute inset-x-4 z-10 flex items-start justify-between" style={{ top: "max(var(--sat), 16px)" }}>
          <HeroIconButton label="חזרה" onClick={onBack}>
            <BackIcon />
          </HeroIconButton>
          {trip.viewerState.isSelf && (
            <div className="pointer-events-auto relative">
              <HeroIconButton label="אפשרויות" onClick={() => setMenuOpen((v) => !v)} expanded={menuOpen}>
                <MoreIcon />
              </HeroIconButton>
              {menuOpen && (
                <>
                  <button type="button" aria-label="סגירה" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
                  <div className="absolute end-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-[16px] bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(15,20,25,0.3)] ring-1 ring-black/[0.06]">
                    <Link href={`/places/trip/${trip.id}/edit`} className="flex h-11 w-full items-center rounded-[10px] px-3 text-[14px] font-semibold text-ink active:bg-[#F1F2F5]">
                      עריכת הטיול
                    </Link>
                    <button type="button" onClick={onDelete} className="flex h-11 w-full items-center rounded-[10px] px-3 text-[14px] font-semibold text-[#C8373C] active:bg-[#F1F2F5]">
                      מחיקה
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* סינון ימים על המפה */}
        {multiDay && (
          <div
            role="group"
            aria-label="הצגת ימים על המפה"
            className="absolute inset-x-0 bottom-11 z-10 flex gap-1.5 overflow-x-auto px-4"
            style={{ scrollbarWidth: "none" }}
          >
            {(["all", ...dayNumbers] as MapDayFilter[]).map((option) => {
              const active = mapDay === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setMapDay(option);
                    setSelectedStopId(null);
                  }}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold shadow-[0_3px_10px_-4px_rgba(15,20,25,0.3)] transition active:scale-95 ${
                    active ? "bg-[#0f1419] text-white" : "bg-white text-ink"
                  }`}
                >
                  {option !== "all" && <span className="h-2.5 w-2.5 rounded-full" style={{ background: dayColor(option) }} />}
                  {option === "all" ? "כל הימים" : `יום ${option}`}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ───── הגיליון ───── */}
      <div className="relative z-10 -mt-6 rounded-t-[28px] bg-white pb-56">
        <div className="mx-auto max-w-xl px-5 pt-5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-ink-secondary">
            {mainCity && (
              <span className="flex items-center gap-1">
                <PinSmallIcon />
                {mainCity}
              </span>
            )}
            <span>{formatTripMeta(trip.stopCount, trip.dayCount)}</span>
            {avgRating != null && <span>· ★ {avgRating.toFixed(1)}</span>}
            {trip.tripType && <span>· {getTripTypeLabel(trip.tripType)}</span>}
            {trip.visibility === "private" ? <span>· פרטי</span> : trip.visibility === "friends" ? <span>· חברים</span> : null}
          </p>
          <h1 className="mt-1.5 text-[28px] font-bold leading-tight tracking-tight text-ink">{trip.title}</h1>

          <Link href={profileHref} className="mt-4 flex items-center gap-3 rounded-[16px] active:opacity-80">
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#EFF1F4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getAvatarUrl(trip.author.avatarUrl)} alt="" className="h-full w-full object-cover" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-ink">{authorName}</span>
              {trip.author.username && <span className="block truncate text-[12.5px] text-ink-secondary">@{trip.author.username}</span>}
            </span>
          </Link>

          {trip.description && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{trip.description}</p>}

          <div className="mt-4 border-y border-black/[0.07] py-1">
            <CollectionActionBar
              item={trip}
              basePath={apiBase}
              sharePath={`/places/trip/${trip.id}`}
              shareText={`${trip.title} - טיול ב-TRIPLACE`}
              commentsActive={commentsOpen}
              onToggleComments={() => setCommentsOpen((v) => !v)}
            />
          </div>
          {commentsOpen && <PostInlineComments postId={trip.id} basePath={apiBase} />}
        </div>

        {/* ───── רגעים מהטיול ───── */}
        {moments.length > 0 && (
          <section aria-labelledby="trip-moments" className="mt-7">
            <h2 id="trip-moments" className="mx-auto max-w-xl px-5 text-[19px] font-bold text-ink">
              רגעים מהטיול
            </h2>
            <div className="mt-3 flex gap-2 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: "none" }}>
              {moments.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => focusStopInList(m.stop.id)}
                  aria-label={`${m.stop.place.name} - מעבר לתחנה`}
                  className="relative h-40 w-[120px] shrink-0 overflow-hidden rounded-[18px] bg-[#EFF1F4] transition active:scale-[0.97]"
                >
                  <MediaTile url={optimizeImage(m.url, 320)} />
                  <span
                    className="absolute end-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white px-1 text-[12px] font-bold text-white"
                    style={{ background: dayColor(m.stop.day) }}
                  >
                    {m.stop.position + 1}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ───── המסלול ───── */}
        <section aria-labelledby="trip-route" className="mx-auto mt-8 max-w-xl px-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="trip-route" className="text-[19px] font-bold text-ink">
              המסלול
            </h2>
            {dayNumbers.length > 0 && (
              <TripQuickAdd
                trip={trip}
                day={dayNumbers[dayNumbers.length - 1]}
                label={multiDay ? `הוספת תחנה ליום ${dayNumbers[dayNumbers.length - 1]}` : "הוספת תחנה"}
                onChanged={onChanged}
                variant="header"
              />
            )}
          </div>
          {trip.stops.length === 0 && <p className="py-6 text-center text-[14px] text-ink-secondary">אין תחנות להצגה בטיול הזה.</p>}

          <div className="mt-2 flex flex-col gap-7">
            {dayNumbers.map((day) => {
              const stops = stopsByDay.get(day) ?? [];
              const color = dayColor(day);
              return (
                <div key={day}>
                  {multiDay && (
                    <h3 className="mb-3 mt-2 flex items-center gap-2 text-[16px] font-bold text-ink">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
                      יום {day}
                      <span className="text-[13px] font-medium text-ink-secondary">{stops.length === 1 ? "תחנה אחת" : `${stops.length} תחנות`}</span>
                    </h3>
                  )}
                  <ol className="flex flex-col">
                    {stops.map((stop, index) => (
                      <StopRow
                        key={stop.id}
                        stop={stop}
                        color={color}
                        isLast={index === stops.length - 1}
                        selected={selectedStopId === stop.id}
                        onShowOnMap={hasCoords(stop) ? () => showStopOnMap(stop) : undefined}
                      />
                    ))}
                  </ol>
                  <TripQuickAdd trip={trip} day={day} label={multiDay ? `הוספת תחנה ליום ${day}` : "הוספת תחנה"} onChanged={onChanged} />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ───── בר פעולה קבוע ───── */}
      <div
        className="fixed inset-x-0 z-30 bg-white/95 px-4 pb-2.5 pt-3 backdrop-blur"
        // *** בקשה מפורשת ("חסר לי פה בר תחתון"): הבר התחתון של האפליקציה נוסף לעמוד, ובר הפעולה יושב ישר מעליו.
        style={{ bottom: "calc(66px + max(env(safe-area-inset-bottom), 22px))" }}
      >
        <div className="mx-auto flex max-w-xl gap-2">
          {goUrl ? (
            <a href={goUrl} target="_blank" rel="noopener noreferrer" className={`${PRIMARY_LINK_CLASS} flex-1`}>
              <NavigateIcon />
              {multiDay && mapDay !== "all" ? `יוצאים לדרך · יום ${mapDay}` : "יוצאים לדרך"}
            </a>
          ) : (
            <span className={`${PRIMARY_LINK_CLASS} flex-1 opacity-50`}>יוצאים לדרך</span>
          )}
          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            aria-label={calendarAddedOn ? `נוסף ליומן ב-${calendarAddedOn}` : "הוספה ליומן"}
            className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#F1F2F5] px-4 text-[15px] font-semibold text-ink transition active:scale-[0.97]"
          >
            <CalendarIcon />
            {calendarAddedOn ? new Date(`${calendarAddedOn}T00:00:00`).toLocaleDateString("he-IL", { day: "numeric", month: "short" }) : "ליומן"}
          </button>
        </div>
      </div>

      {calendarOpen && (
        <AddToCalendarSheet
          item={{ itemType: "trip", id: trip.id, name: trip.title, imageUrl: trip.coverUrl ?? trip.autoCoverUrl, category: trip.tripType }}
          onClose={() => setCalendarOpen(false)}
          onDone={(r) => {
            setCalendarOpen(false);
            if (r.action === "added" && r.date) setCalendarAddedOn(r.date);
          }}
        />
      )}
    </>
  );
}

/** תחנה בציר הזמן: מספר בצבע היום + קו מקווקו לתחנה הבאה, שם, סוג ועיר, הערת היוצר, תמונות, פעולות. */
function StopRow({
  stop,
  color,
  isLast,
  selected,
  onShowOnMap,
}: {
  stop: TripStopDto;
  color: string;
  isLast: boolean;
  selected: boolean;
  onShowOnMap?: () => void;
}) {
  const images = stop.place.imageUrls;
  const extra = images.length - 3;
  const navUrl = hasCoords(stop) ? directionsUrl([{ latitude: stop.place.latitude as number, longitude: stop.place.longitude as number }]) : null;
  const subtitle = [getPlaceCategoryLabel(stop.place.category), stop.place.city].filter(Boolean).join(" · ");

  return (
    <li id={`stop-${stop.id}`} className="flex scroll-mt-24 gap-3">
      <div className="flex w-8 shrink-0 flex-col items-center" aria-hidden="true">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold tabular-nums text-white transition ${selected ? "ring-4 ring-offset-2" : ""}`}
          style={{ background: color, "--tw-ring-color": `${color}40` } as CSSProperties}
        >
          {formatStopNumber(stop.position)}
        </span>
        {!isLast && <span className="mt-1.5 w-0 flex-1 border-r-2 border-dashed border-[#D5DCE6]" />}
      </div>

      <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-7"}`}>
        <Link href={`/place/${stop.place.id}`} className="block active:opacity-70">
          <span className="block text-[17px] font-semibold leading-snug text-ink">{stop.place.name}</span>
          {subtitle && <span className="mt-0.5 block text-[13px] text-ink-secondary">{subtitle}</span>}
        </Link>

        {stop.note && <p className="mt-2.5 rounded-[14px] bg-[#F7F8FA] px-3.5 py-2.5 text-[14px] leading-relaxed text-ink">{stop.note}</p>}

        {images.length > 0 && (
          <Link
            href={`/place/${stop.place.id}`}
            aria-label={`תמונות של ${stop.place.name}`}
            className={`mt-2.5 grid gap-1.5 ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
          >
            {images.slice(0, 3).map((url, i) => (
              <span key={url} className={`relative overflow-hidden rounded-[14px] bg-[#EFF1F4] ${images.length === 1 ? "aspect-[16/9]" : "aspect-square"}`}>
                <MediaTile url={optimizeImage(url, images.length === 1 ? 640 : 280)} />
                {i === 2 && extra > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[16px] font-semibold text-white">+{extra}</span>
                )}
              </span>
            ))}
          </Link>
        )}

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {navUrl && (
            <a
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 items-center gap-1.5 rounded-full bg-[#F1F2F5] px-3.5 text-[13px] font-semibold text-ink active:scale-95"
            >
              <NavigateIcon size={15} />
              ניווט
            </a>
          )}
          {onShowOnMap && (
            <button
              type="button"
              onClick={onShowOnMap}
              className="flex h-9 items-center gap-1.5 rounded-full bg-[#F1F2F5] px-3.5 text-[13px] font-semibold text-ink active:scale-95"
            >
              <PinSmallIcon />
              במפה
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
