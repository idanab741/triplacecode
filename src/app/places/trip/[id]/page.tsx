"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { PostInlineComments } from "@/screens/places/PostInlineComments";
import { SearchResultCard } from "@/screens/search/SearchResultCard";
import { CollectionCover } from "@/screens/collections/CollectionCover";
import { CollectionActionBar } from "@/screens/collections/CollectionActionBar";
import { getAvatarUrl } from "@/constants/avatar";
import { formatStopNumber, formatTripMeta, getTripTypeLabel, type TripDetailDto, type TripStopDto } from "@/services/social/tripTypes";

// המפה (Leaflet) משתמשת ב-window/DOM - נטענת רק בצד הלקוח.
// ResultMap הקיים (מפת תוצאת בניית-טיול): נעצים ממוספרים, צבע לפי יום, וקו מחבר בין התחנות של כל יום.
const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), { ssr: false });

type MapDayFilter = "all" | number;

/** עמוד טיול: "מסלול שאפשר לקחת ולצאת איתו לדרך". Hero -> יוצר -> פעולות -> מסלול הטיול (ימים ותחנות ממוספרות) -> מפה. */
export default function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [trip, setTrip] = useState<TripDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapDay, setMapDay] = useState<MapDayFilter>("all");
  const [justCreated, setJustCreated] = useState(false);

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
  }, [id, user]);

  async function handleDelete() {
    if (!window.confirm("למחוק את הטיול? הפעולה לא הפיכה.")) return;
    const res = await fetch(`/api/social/trips/${id}`, { method: "DELETE" });
    if (res.ok) router.replace("/home");
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <HomeStatusBarTint color="#7C3AED" />
      <PlacesHeader variant="purple" onBack={() => router.back()} />

      {justCreated && (
        <div className="fixed inset-x-4 bottom-24 z-50 rounded-pill bg-ink px-4 py-3 text-center text-[13px] font-semibold text-white shadow-soft">
          יצרתם טיול 🎉
        </div>
      )}

      {error ? (
        <PlacesEmptyState title={error} actionLabel="חזרה" onAction={() => router.back()} />
      ) : !trip ? (
        <div className="p-4">
          <Skeleton className="mb-4 aspect-[16/10] w-full" />
          <Skeleton className="mb-2 h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : (
        <TripBody
          trip={trip}
          commentsOpen={commentsOpen}
          onToggleComments={() => setCommentsOpen((v) => !v)}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((v) => !v)}
          onDelete={handleDelete}
          mapDay={mapDay}
          onMapDayChange={setMapDay}
        />
      )}
    </div>
  );
}

function TripBody({
  trip,
  commentsOpen,
  onToggleComments,
  menuOpen,
  onToggleMenu,
  onDelete,
  mapDay,
  onMapDayChange,
}: {
  trip: TripDetailDto;
  commentsOpen: boolean;
  onToggleComments: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onDelete: () => void;
  mapDay: MapDayFilter;
  onMapDayChange: (day: MapDayFilter) => void;
}) {
  const authorName = trip.author.fullName ?? trip.author.username ?? "מטייל";
  const profileHref = `/places/profile/${trip.author.username ?? trip.author.id}`;
  const apiBase = `/api/social/trips/${trip.id}`;

  // תחנות לפי יום, כל יום ממוין לפי הסדר שלו
  const dayNumbers = [...new Set(trip.stops.map((s) => s.day))].sort((a, b) => a - b);
  const stopsByDay = new Map<number, TripStopDto[]>(
    dayNumbers.map((day) => [day, trip.stops.filter((s) => s.day === day).sort((a, b) => a.position - b.position)])
  );
  const multiDay = dayNumbers.length > 1;

  const ratings = trip.stops.map((s) => s.place.rating).filter((r): r is number => r != null);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  // useMemo: ResultMap מתאים את התצוגה (fitBounds) בכל שינוי של מערך התחנות - בלי זה המפה "קופצת" בכל רינדור (למשל פתיחת תגובות).
  const mapStops = useMemo(
    () =>
      trip.stops
        .filter((s) => s.place.latitude != null && s.place.longitude != null && (mapDay === "all" || s.day === mapDay))
        .sort((a, b) => a.day - b.day || a.position - b.position)
        .map((s) => ({ stopId: s.id, name: s.place.name, latitude: s.place.latitude as number, longitude: s.place.longitude as number, dayIndex: s.day })),
    [trip.stops, mapDay]
  );

  return (
    <>
      <CollectionCover coverUrl={trip.coverUrl ?? trip.autoCoverUrl} collageUrls={[]} type="trips" className="aspect-[16/10] w-full" />

      <div className="px-4 pt-4">
        <div className="flex items-start gap-2">
          <h1 className="min-w-0 flex-1 text-[22px] font-extrabold leading-tight text-ink">{trip.title}</h1>
          {trip.viewerState.isSelf && (
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label="עוד"
                aria-expanded={menuOpen}
                onClick={onToggleMenu}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-black/[0.05]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <button type="button" aria-label="סגור" className="fixed inset-0 z-10 cursor-default" onClick={onToggleMenu} />
                  <div className="absolute end-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl bg-white py-1 shadow-[0_8px_30px_rgba(0,0,0,0.16)] ring-1 ring-black/5">
                    <Link href={`/places/trip/${trip.id}/edit`} className="flex w-full items-center px-3.5 py-2.5 text-[14px] font-semibold text-ink hover:bg-black/[0.04]">
                      עריכה
                    </Link>
                    <button type="button" onClick={onDelete} className="flex w-full items-center px-3.5 py-2.5 text-[14px] font-semibold text-red-500 hover:bg-black/[0.04]">
                      מחיקה
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-ink-secondary">
          <span>{formatTripMeta(trip.stopCount, trip.dayCount)}</span>
          {trip.tripType && <span className="rounded-pill bg-bg-secondary px-2.5 py-0.5 text-[12px] text-ink">{getTripTypeLabel(trip.tripType)}</span>}
          {avgRating != null && <span>⭐ {avgRating.toFixed(1)} ממוצע התחנות</span>}
          {trip.visibility === "private" ? <span>· פרטי</span> : trip.visibility === "friends" ? <span>· חברים</span> : null}
        </div>

        {trip.description && <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">{trip.description}</p>}

        <div className="mt-3 flex items-center gap-2.5">
          <Link href={profileHref} className="shrink-0" aria-label={authorName}>
            <span className="block h-9 w-9 overflow-hidden rounded-full bg-bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getAvatarUrl(trip.author.avatarUrl)} alt="" className="h-full w-full object-cover" />
            </span>
          </Link>
          <Link href={profileHref} className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">
            מאת {authorName}
          </Link>
        </div>

        <div className="mt-3 border-y border-black/[0.07] py-1">
          <CollectionActionBar
            item={trip}
            basePath={apiBase}
            sharePath={`/places/trip/${trip.id}`}
            shareText={`${trip.title} - טיול ב-TRIPLACE`}
            commentsActive={commentsOpen}
            onToggleComments={onToggleComments}
          />
        </div>
        {commentsOpen && <PostInlineComments postId={trip.id} basePath={apiBase} />}
      </div>

      {/* ── מסלול הטיול: ימים ותחנות ממוספרות ── */}
      <section className="px-4 pt-6">
        <h2 className="mb-3 text-[18px] font-extrabold text-ink">מסלול הטיול</h2>
        {trip.stops.length === 0 && <p className="py-6 text-center text-[13px] text-ink-secondary">אין תחנות להצגה בטיול הזה.</p>}

        <div className="flex flex-col gap-6">
          {dayNumbers.map((day) => (
            <div key={day}>
              {/* בטיול של יום אחד לא מעמיסים - כותרת "יום N" רק כשיש כמה ימים */}
              {multiDay && (
                <h3 className="mb-2.5 border-b border-black/[0.07] pb-1.5 text-[15px] font-extrabold" style={{ color: "var(--color-places-purple)" }}>
                  יום {day}
                </h3>
              )}
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                {(stopsByDay.get(day) ?? []).map((stop) => (
                  <div key={stop.id} className="min-w-0">
                    <div className="relative">
                      {/* Place Card הקיים של TRIPLACE (כרטיס תוצאות החיפוש) - עם מספר התחנה */}
                      <SearchResultCard
                        place={{
                          id: stop.place.id,
                          name: stop.place.name,
                          category: stop.place.category,
                          rating: stop.place.rating,
                          city: stop.place.city,
                          image_urls: stop.place.imageUrls,
                        }}
                      />
                      <span
                        className="pointer-events-none absolute start-2 top-2 flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-[12.5px] font-extrabold text-white tabular-nums shadow-soft"
                        style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }}
                      >
                        {formatStopNumber(stop.position)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] font-semibold text-ink-secondary">תחנה {stop.position + 1}</p>
                    {stop.note && <p className="mt-0.5 text-[12.5px] italic leading-snug text-ink-secondary">&ldquo;{stop.note}&rdquo;</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── מפה: חלק מהותי מהטיול (לא תצוגה משנית) ── */}
      <section className="px-4 pt-7">
        <h2 className="mb-3 text-[18px] font-extrabold text-ink">מסלול על המפה</h2>

        {multiDay && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {(["all", ...dayNumbers] as MapDayFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onMapDayChange(option)}
                aria-pressed={mapDay === option}
                className={`shrink-0 rounded-pill px-4 py-1.5 text-[13px] font-semibold ${mapDay === option ? "text-white" : "bg-bg-secondary text-ink-secondary"}`}
                style={mapDay === option ? { background: "var(--color-places-purple)" } : undefined}
              >
                {option === "all" ? "כל הטיול" : `יום ${option}`}
              </button>
            ))}
          </div>
        )}

        {mapStops.length > 0 ? (
          <ResultMap stops={mapStops} numbering="perDay" heightClassName="h-[55vh]" />
        ) : (
          <p className="rounded-card bg-bg-secondary py-8 text-center text-[13px] text-ink-secondary">אין נתוני מיקום לתחנות {mapDay === "all" ? "בטיול הזה" : "ביום הזה"}.</p>
        )}
      </section>
    </>
  );
}
