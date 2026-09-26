"use client";

import { useEffect, useRef, useState } from "react";
import { optimizeImage } from "@/utils/imageUrl";
import Link from "next/link";
import { Skeleton } from "@/components/ui";
import type { ProfileContentFilter, ProfileTileDto } from "@/services/social/profileContentTypes";
import { ContentTypeIcon } from "./contentTypeIcons";

const TABS: { id: ProfileContentFilter; label: string }[] = [
  // *** בקשה מפורשת ("החלוקה עמוסה מידי - אין יותר פוסטים, ושמות אחרים"): הכל · מקומות · מפות · טיולים.
  // פוסטים מוצגים יחד עם הביקורות תחת "מקומות".
  { id: "all", label: "הכל" },
  { id: "review", label: "מקומות" },
  { id: "collection", label: "מפות" },
  { id: "trip", label: "טיולים" },
];

const EMPTY_TEXT: Record<ProfileContentFilter, { self: string; other: string }> = {
  all: { self: "כל מה שתפרסמו - מקומות, מפות וטיולים - יופיע כאן.", other: "אין עדיין תוכן להצגה כאן." },
  post: { self: "עוד לא פרסמתם פוסט.", other: "אין עדיין פוסטים להצגה כאן." },
  review: { self: "עוד לא שיתפתם מקום.", other: "אין עדיין מקומות להצגה כאן." },
  collection: { self: "עוד לא יצרתם מפה.", other: "אין עדיין מפות להצגה כאן." },
  trip: { self: "עוד לא יצרתם טיול.", other: "אין עדיין טיולים להצגה כאן." },
};

/** רקע לאריח בלי תמונה (פוסט טקסט) - גרדיאנט לפי הסוג. */
const TEXT_TILE_BG: Record<ProfileTileDto["kind"], string> = {
  post: "linear-gradient(160deg, #6D5DF6, #3B82F6)",
  review: "linear-gradient(160deg, #F472B6, #FB923C)",
  collection: "linear-gradient(160deg, #34D399, #22D3EE)",
  trip: "linear-gradient(160deg, #FBBF24, #FB7185)",
};

interface Bucket {
  tiles: ProfileTileDto[];
  next: string | null;
  loaded: boolean;
  loadingMore: boolean;
}

async function fetchTiles(username: string, kind: ProfileContentFilter, cursor?: string) {
  const qs = new URLSearchParams({ kind });
  if (cursor) qs.set("cursor", cursor);
  const res = await fetch(`/api/social/profile/${encodeURIComponent(username)}/content?${qs.toString()}`);
  if (!res.ok) throw new Error("failed");
  return (await res.json()) as { tiles: ProfileTileDto[]; nextCursor: string | null };
}

/** אריח בגריד הפרופיל. לחיצה פותחת את עמוד התוכן עצמו (פוסט / ביקורת / חוויה / טיול) - לא חלונית ולא רק תגובות. */
export function ProfileTile({ tile }: { tile: ProfileTileDto }) {
  const content = (
    <>
      {!tile.imageUrl && tile.videoUrl ? (
        <video src={`${tile.videoUrl}#t=0.1`} preload="metadata" muted playsInline className="pointer-events-none h-full w-full object-cover" />
      ) : tile.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={optimizeImage(tile.imageUrl, 160)} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center px-2 text-center" style={{ background: TEXT_TILE_BG[tile.kind] }}>
          <span className="line-clamp-5 text-[12.5px] font-bold leading-snug text-white">{tile.text ?? tile.title ?? ""}</span>
        </span>
      )}

      {/* דירוג (ביקורות בלבד) - בפינה העליונה, כמו בעיצוב */}
      {tile.rating != null && (
        <span className="absolute start-1.5 top-1.5 flex items-center gap-0.5 text-[11.5px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.55)]">
          <span style={{ color: "#FF5CA8" }}>★</span>
          {tile.rating.toFixed(1)}
        </span>
      )}

      {/* אייקון סוג התוכן - פוסט / ביקורת / אוסף / טיול */}
      <span className="absolute end-1.5 top-1.5 text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,.55))]">
        <ContentTypeIcon kind={tile.kind} size={17} />
      </span>


      {tile.title && tile.imageUrl && (
        <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-1.5 pb-2 pt-9 text-center text-[12px] font-bold leading-tight text-white">
          {tile.title}
        </span>
      )}
    </>
  );

  return (
    <Link href={tile.href} className="relative block aspect-[3/4] overflow-hidden bg-bg-secondary">
      {content}
    </Link>
  );
}

interface ProfileContentGridProps {
  username: string;
  isSelf: boolean;
  /** מגדילים כדי לרענן (למשל אחרי פרסום פוסט חדש). */
  refreshKey?: number;
  /** העמוד הראשון של טאב "הכל", שנשלף מראש בשרת (page.tsx) - מוצג מיד, בלי fetch. */
  initialAll?: { tiles: ProfileTileDto[]; nextCursor: string | null } | null;
}

/**
 * תוכן הפרופיל - טאבים עם אייקון (הכל · מקומות · מפות · טיולים) ו-Grid של 3 עמודות ללא שוליים,
 * אריחים לאורך (3:4): תמונה מלאה, כותרת בתחתית, ★ דירוג לביקורות, ואייקון סוג התוכן בפינה.
 * המקור: /api/social/profile/[username]/content (מיזוג פוסטים+ביקורות+אוספים+טיולים).
 */
export function ProfileContentGrid({ username, isSelf, refreshKey = 0, initialAll = null }: ProfileContentGridProps) {
  const [active, setActive] = useState<ProfileContentFilter>("all");
  const [buckets, setBuckets] = useState<Partial<Record<ProfileContentFilter, Bucket>>>(() =>
    initialAll ? { all: { tiles: initialAll.tiles, next: initialAll.nextCursor, loaded: true, loadingMore: false } } : {}
  );
  const versionRef = useRef(0);
  const firstRunRef = useRef(true);
  const bucket = buckets[active];
  // איפוס כשמשתמש/גרסה משתנים (לא בטעינה הראשונה - שם יש נתוני התחלה מהשרת)
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    versionRef.current += 1;
    setBuckets({});
  }, [username, refreshKey]);

  // טעינה ראשונה של הטאב הפעיל
  useEffect(() => {
    if (bucket) return;
    const version = versionRef.current;
    const kind = active;
    setBuckets((prev) => ({ ...prev, [kind]: { tiles: [], next: null, loaded: false, loadingMore: false } }));
    fetchTiles(username, kind)
      .then((r) => {
        if (version !== versionRef.current) return;
        setBuckets((prev) => ({ ...prev, [kind]: { tiles: r.tiles, next: r.nextCursor, loaded: true, loadingMore: false } }));
      })
      .catch(() => {
        if (version !== versionRef.current) return;
        setBuckets((prev) => ({ ...prev, [kind]: { tiles: [], next: null, loaded: true, loadingMore: false } }));
      });
  }, [active, bucket, username]);

  async function handleLoadMore() {
    if (!bucket?.next || bucket.loadingMore) return;
    const version = versionRef.current;
    const kind = active;
    setBuckets((prev) => ({ ...prev, [kind]: { ...(prev[kind] as Bucket), loadingMore: true } }));
    try {
      const r = await fetchTiles(username, kind, bucket.next);
      if (version !== versionRef.current) return;
      setBuckets((prev) => {
        const cur = prev[kind] as Bucket;
        return { ...prev, [kind]: { tiles: [...cur.tiles, ...r.tiles], next: r.nextCursor, loaded: true, loadingMore: false } };
      });
    } catch {
      setBuckets((prev) => ({ ...prev, [kind]: { ...(prev[kind] as Bucket), loadingMore: false } }));
    }
  }

  return (
    <div className="mt-5">
      <div role="tablist" className="flex border-b border-black/[0.07]">
        {TABS.map((tab) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.id)}
              className={`relative flex flex-1 flex-col items-center gap-1 pb-2.5 pt-3 text-[12px] transition-colors ${selected ? "font-semibold text-ink" : "font-medium text-ink-secondary"}`}
            >
              <ContentTypeIcon kind={tab.id === "all" ? "all" : tab.id} size={22} />
              {tab.label}
              {selected && <span className="absolute inset-x-4 -bottom-px h-[2px] rounded-full bg-ink" />}
            </button>
          );
        })}
      </div>

      {(!bucket || !bucket.loaded) && (
        <div className="grid grid-cols-3 gap-0.5 pt-0.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-none" />
          ))}
        </div>
      )}

      {bucket?.loaded && bucket.tiles.length === 0 && (
        <div className="flex flex-col items-center px-8 py-12 text-center">
          <p className="max-w-[280px] text-[14.5px] leading-relaxed text-ink-secondary">{isSelf ? EMPTY_TEXT[active].self : EMPTY_TEXT[active].other}</p>
          {isSelf && (
            <Link
              href="/content"
              className="mt-4 flex h-10 items-center rounded-xl bg-[#EFF1F4] px-5 text-[14px] font-semibold text-ink transition active:scale-[0.98]"
            >
              יצירת תוכן
            </Link>
          )}
        </div>
      )}

      {bucket?.loaded && bucket.tiles.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-0.5 pt-0.5">
            {bucket.tiles.map((tile) => (
              <ProfileTile key={tile.key} tile={tile} />
            ))}
          </div>
          {bucket.next && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={bucket.loadingMore}
              className="w-full py-4 text-[13px] font-semibold text-ink-secondary disabled:opacity-50"
            >
              {bucket.loadingMore ? "טוען..." : "טען עוד"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
