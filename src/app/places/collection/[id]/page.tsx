"use client";

import { use, useEffect, useState } from "react";
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
import { TripCard } from "@/screens/collections/TripCard";
import { getAvatarUrl } from "@/constants/avatar";
import { COLLECTION_TYPE_LABELS, type CollectionDetailDto, type CollectionPlaceItemDto } from "@/services/social/collectionTypes";

// המפה (Leaflet) משתמשת ב-window/DOM - נטענת רק בצד הלקוח, ורק כשנכנסים ללשונית "מפה".
const DiscoveryPlacesMap = dynamic(() => import("@/screens/discovery/DiscoveryPlacesMap").then((m) => m.DiscoveryPlacesMap), {
  ssr: false,
});

type PlacesView = "gallery" | "map";

/** עמוד אוסף: Cover גדול -> מידע על היוצר -> Grid של התוכן.
 *  אוסף מקומות: Grid (ברירת מחדל) + מפה כתצוגה נוספת. אוסף טיולים: Grid בלבד. */
export default function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<PlacesView>("gallery");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/social/collections/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "שגיאה בטעינת האוסף");
        setCollection(data.collection as CollectionDetailDto);
      })
      .catch((err) => setError(err.message));
  }, [id, user]);

  async function handleDelete() {
    if (!window.confirm("למחוק את האוסף? הפעולה לא הפיכה.")) return;
    const res = await fetch(`/api/social/collections/${id}`, { method: "DELETE" });
    if (res.ok) router.replace("/places");
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <HomeStatusBarTint color="#7C3AED" />
      <PlacesHeader variant="purple" onBack={() => router.back()} />

      {error ? (
        <PlacesEmptyState title={error} actionLabel="חזרה" onAction={() => router.back()} />
      ) : !collection ? (
        <div className="p-4">
          <Skeleton className="mb-4 aspect-[16/10] w-full" />
          <Skeleton className="mb-2 h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : (
        <CollectionBody
          collection={collection}
          view={view}
          onViewChange={setView}
          commentsOpen={commentsOpen}
          onToggleComments={() => setCommentsOpen((v) => !v)}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((v) => !v)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function CollectionBody({
  collection,
  view,
  onViewChange,
  commentsOpen,
  onToggleComments,
  menuOpen,
  onToggleMenu,
  onDelete,
}: {
  collection: CollectionDetailDto;
  view: PlacesView;
  onViewChange: (view: PlacesView) => void;
  commentsOpen: boolean;
  onToggleComments: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onDelete: () => void;
}) {
  const authorName = collection.author.fullName ?? collection.author.username ?? "מטייל";
  const profileHref = `/places/profile/${collection.author.username ?? collection.author.id}`;
  const placeItems = collection.items.filter((i): i is CollectionPlaceItemDto => i.kind === "place");
  const mapPlaces = placeItems.map((i) => ({
    id: i.place.id,
    name: i.place.name,
    latitude: i.place.latitude,
    longitude: i.place.longitude,
    imageUrls: i.place.imageUrls,
    category: i.place.category,
  }));
  const hasMapPoints = mapPlaces.some((p) => p.latitude != null && p.longitude != null);

  return (
    <>
      <CollectionCover coverUrl={collection.coverUrl} collageUrls={collection.collageUrls} type={collection.type} className="aspect-[16/10] w-full" />

      <div className="px-4 pt-4">
        <div className="flex items-start gap-2">
          <h1 className="min-w-0 flex-1 text-[22px] font-extrabold leading-tight text-ink">{collection.title}</h1>
          {collection.viewerState.isSelf && (
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
                    <Link href={`/places/collection/${collection.id}/edit`} className="flex w-full items-center px-3.5 py-2.5 text-[14px] font-semibold text-ink hover:bg-black/[0.04]">
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

        {collection.description && <p className="mt-1.5 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">{collection.description}</p>}

        <div className="mt-3 flex items-center gap-2.5">
          <Link href={profileHref} className="shrink-0" aria-label={authorName}>
            <span className="block h-9 w-9 overflow-hidden rounded-full bg-bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getAvatarUrl(collection.author.avatarUrl)} alt="" className="h-full w-full object-cover" />
            </span>
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={profileHref} className="block truncate text-[14px] font-bold text-ink">
              מאת {authorName}
            </Link>
            <span className="text-[12.5px] text-ink-secondary">
              {COLLECTION_TYPE_LABELS[collection.type].itemCount(collection.itemCount)}
              {collection.visibility === "private" ? " · פרטי" : collection.visibility === "friends" ? " · חברים" : ""}
            </span>
          </div>
        </div>

        <div className="mt-3 border-y border-black/[0.07] py-1">
          <CollectionActionBar item={collection} commentsActive={commentsOpen} onToggleComments={onToggleComments} />
        </div>
        {commentsOpen && <PostInlineComments postId={collection.id} basePath={`/api/social/collections/${collection.id}`} />}
      </div>

      {collection.type === "places" && (
        <div role="tablist" className="mt-3 flex justify-center gap-8 border-b border-black/[0.07]">
          {(
            [
              { id: "gallery", label: "גלריה" },
              { id: "map", label: "מפה" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={view === tab.id}
              onClick={() => onViewChange(tab.id)}
              className="relative pb-2.5 pt-1.5 text-[13.5px] font-bold transition-colors"
              style={{ color: view === tab.id ? "var(--color-places-purple)" : "var(--color-ink-secondary, #8a94a6)" }}
            >
              {tab.label}
              {view === tab.id && <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full" style={{ background: "var(--color-places-purple)" }} />}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 pt-4">
        {collection.items.length === 0 && <p className="py-8 text-center text-[13px] text-ink-secondary">אין פריטים להצגה באוסף הזה.</p>}

        {collection.type === "places" && view === "gallery" && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            {placeItems.map((item) => (
              <div key={item.id} className="min-w-0">
                {/* Place Card הקיים של TRIPLACE (אותו כרטיס של תוצאות החיפוש) - לא עיצוב חדש */}
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
                {item.note && <p className="mt-1 text-[12.5px] italic leading-snug text-ink-secondary">&ldquo;{item.note}&rdquo;</p>}
              </div>
            ))}
          </div>
        )}

        {collection.type === "places" && view === "map" &&
          (hasMapPoints ? (
            <DiscoveryPlacesMap places={mapPlaces} heightClassName="h-[62vh]" />
          ) : (
            <p className="py-8 text-center text-[13px] text-ink-secondary">אין נתוני מיקום למקומות באוסף הזה.</p>
          ))}

        {collection.type === "trips" && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            {collection.items.map((item) =>
              item.kind === "trip" ? (
                <div key={item.id} className="min-w-0">
                  <TripCard title={item.trip.title} imageUrl={item.trip.imageUrl} stopCount={item.trip.stopCount} href={item.trip.href} />
                  {item.note && <p className="mt-1 text-[12.5px] italic leading-snug text-ink-secondary">&ldquo;{item.note}&rdquo;</p>}
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    </>
  );
}
