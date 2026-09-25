"use client";

import { MainBottomNav } from "@/components/MainBottomNav";
import { use, useEffect, useMemo, useRef, useState, type CSSProperties, type UIEvent } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { PostInlineComments } from "@/screens/places/PostInlineComments";
import { SearchResultCard } from "@/screens/search/SearchResultCard";
import { CollectionCover } from "@/screens/collections/CollectionCover";
import { CollectionActionBar } from "@/screens/collections/CollectionActionBar";
import { getAvatarUrl } from "@/constants/avatar";
import { getPlaceCategoryLabel } from "@/constants/placeCategories";
import { optimizeImage } from "@/utils/imageUrl";
import { CREATE_INK } from "@/screens/create/CreateUi";
import { directionsUrl, journeyColor, type JourneyLine, type JourneyMarker } from "@/screens/journey/journeyUtils";
import {
  BackIcon,
  ChevronEndIcon,
  ChevronStartIcon,
  ExpandIcon,
  HeroIconButton,
  MediaTile,
  MoreIcon,
  NavigateIcon,
  PinSmallIcon,
} from "@/screens/journey/JourneyUi";
import {
  COLLECTION_TYPE_LABELS,
  type CollectionDetailDto,
  type CollectionPlaceItemDto,
  type CollectionTripItemDto,
} from "@/services/social/collectionTypes";

// המפה (Leaflet) משתמשת ב-window/DOM - נטענת רק בצד הלקוח.
const JourneyMap = dynamic(() => import("@/screens/journey/JourneyMap").then((m) => m.JourneyMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#EEF0EA]" />,
});

const BLUE = "#0A6DFE";

/**
 * *** עיצוב מחדש (בקשה מפורשת - "בעמוד החוויות (בשניהם) - בסוף יצא עמוד עם מפה עם נעצים בכל המקומות",
 * מעוצב, בקו העיצובי של האפליקציה, נגיש ומזמין):
 *  • חוויה של מקומות: קולאז' -> כותרת/יוצר/פעולות -> מפה עם נעץ-תמונה לכל מקום + כרטיס המקום הנבחר
 *    עם דפדוף (הקודם/הבא) -> המקומות עצמם: גלריית תמונות גדולה, הערת היוצר, "במפה" ו"ניווט".
 *    הגלריה הישנה (רשת כרטיסים) נשארה כתצוגה חלופית.
 *  • חוויה של טיולים: מפה בראש העמוד עם המסלול של כל טיול בצבע ובסגנון קו משלו -> כרטיס לכל טיול
 *    בצבע התואם. המסלולים מגיעים מהשרת (trip.route - תוספת ל-collectionService).
 */
export default function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/social/collections/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "שגיאה בטעינת החוויה");
        setCollection(data.collection as CollectionDetailDto);
      })
      .catch((err) => setError(err.message));
  }, [id, user]);

  async function handleDelete() {
    if (!window.confirm("למחוק את החוויה? הפעולה לא הפיכה.")) return;
    const res = await fetch(`/api/social/collections/${id}`, { method: "DELETE" });
    if (res.ok) router.replace("/home");
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-white pb-32" style={CREATE_INK}>
        <HomeStatusBarTint />
        <CollapsibleTopBar onBack={() => router.back()} />
        {error ? (
          <PlacesEmptyState title={error} actionLabel="חזרה" onAction={() => router.back()} />
        ) : (
          <div aria-busy="true" aria-label="טוען את החוויה" className="mx-auto max-w-xl px-4 pt-2">
            <div className="aspect-[16/10] w-full animate-pulse rounded-[24px] bg-[#EFF1F4]" />
            <div className="mt-5 h-8 w-3/4 animate-pulse rounded-lg bg-[#EFF1F4]" />
            <div className="mt-4 flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-[#EFF1F4]" />
              <div className="h-4 w-32 animate-pulse rounded bg-[#EFF1F4]" />
            </div>
            <div className="mt-6 h-[300px] w-full animate-pulse rounded-[24px] bg-[#EEF0EA]" />
          </div>
        )}
        <MainBottomNav active="places" />
      </div>
    );
  }

  // *** בקשה מפורשת ("חסר לי פה בר תחתון"): הבר התחתון של האפליקציה גם בעמוד האוסף.
  return collection.type === "trips" ? (
    <>
      <TripsExperience collection={collection} onBack={() => router.back()} onDelete={handleDelete} />
      <MainBottomNav active="places" />
    </>
  ) : (
    <>
      <PlacesExperience collection={collection} onBack={() => router.back()} onDelete={handleDelete} />
      <MainBottomNav active="places" />
    </>
  );
}

/* ═════════════════════════════ חלקים משותפים ═════════════════════════════ */

function OwnerMenu({ collectionId, onDelete }: { collectionId: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-auto relative">
      <HeroIconButton label="אפשרויות" onClick={() => setOpen((v) => !v)} expanded={open}>
        <MoreIcon />
      </HeroIconButton>
      {open && (
        <>
          <button type="button" aria-label="סגירה" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-[16px] bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(15,20,25,0.3)] ring-1 ring-black/[0.06]">
            <Link href={`/places/collection/${collectionId}/edit`} className="flex h-11 w-full items-center rounded-[10px] px-3 text-[14px] font-semibold text-ink active:bg-[#F1F2F5]">
              עריכת החוויה
            </Link>
            <button type="button" onClick={onDelete} className="flex h-11 w-full items-center rounded-[10px] px-3 text-[14px] font-semibold text-[#C8373C] active:bg-[#F1F2F5]">
              מחיקה
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** כותרת, יוצר, תיאור ופעולות חברתיות - אותו בלוק בשני סוגי החוויה. */
function ExperienceHeader({ collection }: { collection: CollectionDetailDto }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const authorName = collection.author.fullName ?? collection.author.username ?? "מטייל";
  const profileHref = `/places/profile/${collection.author.username ?? collection.author.id}`;

  return (
    <div className="mx-auto max-w-xl px-5">
      <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-medium text-ink-secondary">
        <span>חוויה</span>
        <span>· {COLLECTION_TYPE_LABELS[collection.type].itemCount(collection.itemCount)}</span>
        {collection.visibility === "private" ? <span>· פרטי</span> : collection.visibility === "friends" ? <span>· חברים</span> : null}
      </p>
      <h1 className="mt-1.5 text-[28px] font-bold leading-tight tracking-tight text-ink">{collection.title}</h1>

      <Link href={profileHref} className="mt-4 flex items-center gap-3 active:opacity-80">
        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#EFF1F4]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getAvatarUrl(collection.author.avatarUrl)} alt="" className="h-full w-full object-cover" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{authorName}</span>
          {collection.author.username && <span className="block truncate text-[12.5px] text-ink-secondary">@{collection.author.username}</span>}
        </span>
      </Link>

      {collection.description && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{collection.description}</p>}

      <div className="mt-4 border-y border-black/[0.07] py-1">
        <CollectionActionBar item={collection} commentsActive={commentsOpen} onToggleComments={() => setCommentsOpen((v) => !v)} />
      </div>
      {commentsOpen && <PostInlineComments postId={collection.id} basePath={`/api/social/collections/${collection.id}`} />}
    </div>
  );
}

/** הערת היוצר על פריט - בועה עם התמונה שלו, כמו בצ'אט. */
function CreatorNote({ note, avatarUrl }: { note: string; avatarUrl: string | null }) {
  return (
    <div className="mt-2.5 flex items-start gap-2">
      <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-[#EFF1F4]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getAvatarUrl(avatarUrl)} alt="" className="h-full w-full object-cover" />
      </span>
      <p className="rounded-[4px_16px_16px_16px] bg-[#F7F8FA] px-3.5 py-2.5 text-[14px] leading-relaxed text-ink">{note}</p>
    </div>
  );
}

const PILL_CLASS = "flex h-9 items-center gap-1.5 rounded-full bg-[#F1F2F5] px-3.5 text-[13px] font-semibold text-ink active:scale-95";

/* ═════════════════════════════ חוויה של מקומות ═════════════════════════════ */

function PlacesExperience({ collection, onBack, onDelete }: { collection: CollectionDetailDto; onBack: () => void; onDelete: () => void }) {
  const items = useMemo(
    () => collection.items.filter((i): i is CollectionPlaceItemDto => i.kind === "place").sort((a, b) => a.position - b.position),
    [collection.items]
  );
  const mappable = useMemo(() => items.filter((i) => i.place.latitude != null && i.place.longitude != null), [items]);
  const [selectedId, setSelectedId] = useState<string | null>(mappable[0]?.id ?? null);
  const [mapLarge, setMapLarge] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");
  const mapRef = useRef<HTMLDivElement>(null);

  const markers = useMemo<JourneyMarker[]>(
    () =>
      mappable.map((item) => ({
        id: item.id,
        latitude: item.place.latitude as number,
        longitude: item.place.longitude as number,
        name: item.place.name,
        imageUrl: item.place.imageUrls[0] ? optimizeImage(item.place.imageUrls[0], 120) : null,
        label: String(items.indexOf(item) + 1),
        color: BLUE,
      })),
    [mappable, items]
  );

  const selectedIndex = mappable.findIndex((i) => i.id === selectedId);
  const selected = selectedIndex >= 0 ? mappable[selectedIndex] : null;

  function step(delta: number) {
    if (mappable.length === 0) return;
    const next = (Math.max(selectedIndex, 0) + delta + mappable.length) % mappable.length;
    setSelectedId(mappable[next].id);
  }

  function showOnMap(itemId: string) {
    setSelectedId(itemId);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="min-h-screen bg-white pb-32" style={CREATE_INK}>
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={onBack} />

      <div className="mx-auto max-w-xl px-4 pt-1">
        <div className="relative overflow-hidden rounded-[24px]">
          <CollectionCover coverUrl={collection.coverUrl} collageUrls={collection.collageUrls} type="places" className="aspect-[16/10] w-full" />
          {collection.viewerState.isSelf && (
            <div className="absolute end-3 top-3">
              <OwnerMenu collectionId={collection.id} onDelete={onDelete} />
            </div>
          )}
        </div>
      </div>

      <div className="pt-5">
        <ExperienceHeader collection={collection} />
      </div>

      {/* ───── מפה ───── */}
      {mappable.length > 0 && (
        <section aria-label="המקומות על המפה" className="mx-auto mt-6 max-w-xl px-4">
          <div ref={mapRef} className={`relative overflow-hidden rounded-[24px] bg-[#EEF0EA] transition-[height] duration-300 ${mapLarge ? "h-[70vh]" : "h-[340px]"}`}>
            <style>{`.exp-places-map .leaflet-bottom{bottom:96px}`}</style>
            <div className="exp-places-map h-full">
              <JourneyMap
                markers={markers}
                selectedId={selectedId}
                onSelect={setSelectedId}
                className="h-full"
                padding={{ top: 64, right: 48, bottom: 120, left: 48 }}
              />
            </div>

            <div className="absolute start-3 top-3 z-10">
              <HeroIconButton label={mapLarge ? "הקטנת המפה" : "הגדלת המפה"} onClick={() => setMapLarge((v) => !v)} expanded={mapLarge}>
                <ExpandIcon />
              </HeroIconButton>
            </div>

            {/* כרטיס המקום הנבחר + דפדוף */}
            {selected && (
              <div className="absolute inset-x-3 bottom-3 z-10 flex items-center gap-2.5 rounded-[18px] bg-white p-2 shadow-[0_8px_22px_-8px_rgba(15,20,25,0.35)]">
                <Link href={`/place/${selected.place.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 active:opacity-80">
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[12px] bg-[#EFF1F4]">
                    {selected.place.imageUrls[0] && <MediaTile url={optimizeImage(selected.place.imageUrls[0], 160)} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{selected.place.name}</span>
                    <span className="block truncate text-[12.5px] text-ink-secondary">
                      {[getPlaceCategoryLabel(selected.place.category), selected.place.city].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
                {mappable.length > 1 && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => step(-1)} aria-label="המקום הקודם" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F2F5] text-ink active:scale-90">
                      <ChevronStartIcon />
                    </button>
                    <span className="min-w-[2.6rem] text-center text-[12.5px] font-semibold tabular-nums text-ink-secondary" aria-live="polite">
                      {selectedIndex + 1}/{mappable.length}
                    </span>
                    <button type="button" onClick={() => step(1)} aria-label="המקום הבא" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F2F5] text-ink active:scale-90">
                      <ChevronEndIcon />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ───── המקומות ───── */}
      <section aria-labelledby="exp-places-title" className="mx-auto mt-8 max-w-xl px-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 id="exp-places-title" className="text-[19px] font-bold text-ink">
            {COLLECTION_TYPE_LABELS.places.itemCount(items.length)}
          </h2>
          {items.length > 0 && (
            <div role="radiogroup" aria-label="תצוגה" className="flex rounded-full bg-[#F1F2F5] p-[3px]">
              {(
                [
                  { id: "list", label: "רשימה" },
                  { id: "grid", label: "גלריה" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={view === option.id}
                  onClick={() => setView(option.id)}
                  className={`h-8 rounded-full px-3.5 text-[13px] font-semibold transition ${
                    view === option.id ? "bg-white text-ink shadow-[0_1px_3px_rgba(15,20,25,0.12)]" : "text-ink-secondary"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length === 0 && <p className="py-8 text-center text-[14px] text-ink-secondary">אין מקומות להצגה בחוויה הזו.</p>}

        {view === "list" ? (
          <ol className="mt-4 flex flex-col gap-8">
            {items.map((item, index) => (
              <PlaceItemCard
                key={item.id}
                item={item}
                number={index + 1}
                authorAvatar={collection.author.avatarUrl}
                onShowOnMap={item.place.latitude != null && item.place.longitude != null ? () => showOnMap(item.id) : undefined}
              />
            ))}
          </ol>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
            {items.map((item) => (
              <div key={item.id} className="min-w-0">
                <SearchResultCard
                  place={{
                    id: item.place.id,
                    name: item.place.name,
                    category: item.place.category,
                    rating: item.place.rating,
                    city: item.place.city,
                    image_urls: item.place.imageUrls,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** מקום בחוויה: גלריה גדולה (החלקה בין התמונות), שם, סוג ועיר, דירוג, הערת היוצר ופעולות. */
function PlaceItemCard({
  item,
  number,
  authorAvatar,
  onShowOnMap,
}: {
  item: CollectionPlaceItemDto;
  number: number;
  authorAvatar: string | null;
  onShowOnMap?: () => void;
}) {
  const images = item.place.imageUrls.slice(0, 6);
  const [current, setCurrent] = useState(0);
  const navUrl =
    item.place.latitude != null && item.place.longitude != null
      ? directionsUrl([{ latitude: item.place.latitude, longitude: item.place.longitude }])
      : null;

  function handleScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const index = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    if (index !== current) setCurrent(index);
  }

  return (
    <li>
      <div className="relative overflow-hidden rounded-[20px] bg-[#EFF1F4]">
        {images.length > 0 ? (
          <div
            className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
            onScroll={handleScroll}
            aria-label={`תמונות של ${item.place.name}`}
          >
            {images.map((url) => (
              <div key={url} className="relative h-full w-full shrink-0 snap-center">
                <MediaTile url={optimizeImage(url, 720)} />
              </div>
            ))}
          </div>
        ) : (
          <Link href={`/place/${item.place.id}`} className="flex aspect-[4/3] items-center justify-center text-[#9aa1ad]" aria-label={item.place.name}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
              <circle cx="9" cy="10" r="1.8" />
              <path d="m20.5 15.5-4.5-4.5L6 19.5" />
            </svg>
          </Link>
        )}

        <span className="pointer-events-none absolute end-3 top-3 flex h-8 min-w-8 items-center justify-center rounded-full bg-white px-1.5 text-[13px] font-bold text-ink shadow-[0_2px_6px_rgba(15,20,25,0.2)]">
          {number}
        </span>
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden="true">
            {images.map((url, i) => (
              <span key={url} className={`h-1.5 rounded-full transition-all ${i === current ? "w-5 bg-white" : "w-1.5 bg-white/60"}`} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-start justify-between gap-3 px-1">
        <Link href={`/place/${item.place.id}`} className="min-w-0 active:opacity-70">
          <span className="block text-[18px] font-semibold leading-snug text-ink">{item.place.name}</span>
          <span className="mt-0.5 block text-[13px] text-ink-secondary">
            {[getPlaceCategoryLabel(item.place.category), item.place.city].filter(Boolean).join(" · ")}
          </span>
        </Link>
        {item.place.rating != null && (
          <span className="flex shrink-0 items-center gap-1 pt-1 text-[14px] font-semibold text-ink" aria-label={`דירוג ${item.place.rating.toFixed(1)}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#F5B301" aria-hidden="true">
              <path d="M12 2.8l2.84 5.76 6.36.92-4.6 4.49 1.08 6.33L12 17.31l-5.68 2.99 1.08-6.33-4.6-4.49 6.36-.92L12 2.8z" />
            </svg>
            {item.place.rating.toFixed(1)}
          </span>
        )}
      </div>

      <div className="px-1">
        {item.note && <CreatorNote note={item.note} avatarUrl={authorAvatar} />}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {onShowOnMap && (
            <button type="button" onClick={onShowOnMap} className={PILL_CLASS}>
              <PinSmallIcon />
              במפה
            </button>
          )}
          {navUrl && (
            <a href={navUrl} target="_blank" rel="noopener noreferrer" className={PILL_CLASS}>
              <NavigateIcon size={15} />
              ניווט
            </a>
          )}
          <Link href={`/place/${item.place.id}`} className={PILL_CLASS}>
            לעמוד המקום
          </Link>
        </div>
      </div>
    </li>
  );
}

/* ═════════════════════════════ חוויה של טיולים ═════════════════════════════ */

function TripsExperience({ collection, onBack, onDelete }: { collection: CollectionDetailDto; onBack: () => void; onDelete: () => void }) {
  const items = useMemo(
    () => collection.items.filter((i): i is CollectionTripItemDto => i.kind === "trip").sort((a, b) => a.position - b.position),
    [collection.items]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const colorOf = (item: CollectionTripItemDto) => journeyColor(items.indexOf(item));

  const routed = useMemo(() => items.filter((i) => (i.trip.route?.length ?? 0) > 0), [items]);
  // לכל טיול: נעץ בתחילת המסלול ונעץ בסופו, שניהם עם המספר של הטיול ובצבע שלו. המסלול עצמו הוא הקו.
  // (שני הקצוות גם מבטיחים שה-fitBounds יכלול את כל המסלול, לא רק את נקודות ההתחלה.)
  const markers = useMemo<JourneyMarker[]>(
    () =>
      routed.flatMap((item) => {
        const route = item.trip.route!;
        const n = items.indexOf(item);
        const base = { name: item.trip.title, label: String(n + 1), color: journeyColor(n) };
        const start: JourneyMarker = { id: item.id, latitude: route[0].latitude, longitude: route[0].longitude, ...base };
        if (route.length < 2) return [start];
        const last = route[route.length - 1];
        return [start, { id: `${item.id}-end`, latitude: last.latitude, longitude: last.longitude, ...base }];
      }),
    [routed, items]
  );
  const lines = useMemo<JourneyLine[]>(
    () =>
      routed
        .filter((item) => item.trip.route!.length > 1)
        .map((item) => ({
          id: item.id,
          points: item.trip.route!,
          color: journeyColor(items.indexOf(item)),
          dashed: items.indexOf(item) % 2 === 1,
        })),
    [routed, items]
  );

  function focusTrip(itemId: string) {
    const clean = itemId.replace(/-end$/, "");
    setSelectedId(clean);
    document.getElementById(`exp-trip-${clean}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function showOnMap(itemId: string) {
    setSelectedId(itemId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const hasMap = markers.length > 0;

  return (
    <div className="min-h-screen bg-white pb-32" style={CREATE_INK}>
      <HomeStatusBarTint />

      {hasMap ? (
        <div className="exp-trips-map relative h-[46vh] min-h-[300px] max-h-[460px] bg-[#EEF0EA]">
          <style>{`.exp-trips-map .leaflet-bottom{bottom:30px}`}</style>
          <JourneyMap
            markers={markers}
            lines={lines}
            selectedId={selectedId}
            onSelect={focusTrip}
            className="h-full"
            padding={{ top: 90, right: 48, bottom: 70, left: 48 }}
          />
          <div className="pointer-events-none absolute inset-x-4 z-10 flex items-start justify-between" style={{ top: "max(env(safe-area-inset-top), 16px)" }}>
            <HeroIconButton label="חזרה" onClick={onBack}>
              <BackIcon />
            </HeroIconButton>
            {collection.viewerState.isSelf && <OwnerMenu collectionId={collection.id} onDelete={onDelete} />}
          </div>
        </div>
      ) : (
        <>
          <CollapsibleTopBar onBack={onBack} />
          <div className="mx-auto max-w-xl px-4 pt-1">
            <div className="relative overflow-hidden rounded-[24px]">
              <CollectionCover coverUrl={collection.coverUrl} collageUrls={collection.collageUrls} type="trips" className="aspect-[16/10] w-full" />
              {collection.viewerState.isSelf && (
                <div className="absolute end-3 top-3">
                  <OwnerMenu collectionId={collection.id} onDelete={onDelete} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className={`relative z-10 bg-white ${hasMap ? "-mt-6 rounded-t-[28px] pt-5" : "pt-5"}`}>
        <ExperienceHeader collection={collection} />

        <section aria-labelledby="exp-trips-title" className="mx-auto mt-7 max-w-xl px-4">
          <h2 id="exp-trips-title" className="px-1 text-[19px] font-bold text-ink">
            {COLLECTION_TYPE_LABELS.trips.itemCount(items.length)}
          </h2>
          {items.length === 0 && <p className="py-8 text-center text-[14px] text-ink-secondary">אין טיולים להצגה בחוויה הזו.</p>}

          <ol className="mt-3 flex flex-col gap-3">
            {items.map((item, index) => (
              <TripItemCard
                key={item.id}
                item={item}
                number={index + 1}
                color={colorOf(item)}
                selected={selectedId === item.id}
                authorAvatar={collection.author.avatarUrl}
                onShowOnMap={hasMap && (item.trip.route?.length ?? 0) > 0 ? () => showOnMap(item.id) : undefined}
              />
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function TripItemCard({
  item,
  number,
  color,
  selected,
  authorAvatar,
  onShowOnMap,
}: {
  item: CollectionTripItemDto;
  number: number;
  color: string;
  selected: boolean;
  authorAvatar: string | null;
  onShowOnMap?: () => void;
}) {
  const media = (
    <span className="relative block aspect-[16/9] overflow-hidden rounded-[16px] bg-[#EFF1F4]">
      {item.trip.imageUrl && <MediaTile url={optimizeImage(item.trip.imageUrl, 720)} />}
      <span
        className="absolute end-2.5 top-2.5 flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white px-1.5 text-[13px] font-bold text-white"
        style={{ background: color }}
      >
        {number}
      </span>
    </span>
  );
  const titleRow = (
    <span className="flex items-center gap-3 px-1 pt-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-semibold text-ink">{item.trip.title}</span>
        <span className="mt-0.5 block text-[13px] text-ink-secondary">{item.trip.stopCount === 1 ? "תחנה אחת" : `${item.trip.stopCount} תחנות`}</span>
      </span>
      {item.trip.href && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-ink" aria-hidden="true">
          <ChevronEndIcon />
        </span>
      )}
    </span>
  );

  return (
    <li
      id={`exp-trip-${item.id}`}
      className={`scroll-mt-24 rounded-[22px] bg-[#F7F8FA] p-2.5 transition ${selected ? "ring-2 ring-offset-2" : ""}`}
      style={selected ? ({ "--tw-ring-color": color } as CSSProperties) : undefined}
    >
      {item.trip.href ? (
        <Link href={item.trip.href} className="block active:opacity-80">
          {media}
          {titleRow}
        </Link>
      ) : (
        <div>
          {media}
          {titleRow}
          <p className="px-1 pt-1 text-[12.5px] text-ink-secondary">הטיול הזה זמין לצפייה רק ליוצר שלו</p>
        </div>
      )}

      <div className="px-1 pb-1">
        {item.note && <CreatorNote note={item.note} avatarUrl={authorAvatar} />}
        {onShowOnMap && (
          <div className="mt-2.5 flex gap-1.5">
            <button type="button" onClick={onShowOnMap} className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold text-ink active:scale-95">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
              במפה
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
