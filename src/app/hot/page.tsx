"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { CREATE_INK } from "@/screens/create/CreateUi";
import { MediaTile } from "@/screens/journey/JourneyUi";
import { HOME_QUICK_CATEGORIES, type HomeQuickCategoryId } from "@/constants/homeQuickCategories";
import { optimizeImage } from "@/utils/imageUrl";
import type { HotPlaceItem, HotTripItem } from "@/app/api/hot/route";

/**
 * *** חדש (בקשה מפורשת - "תבנה עמוד חדש ל'כל מה שחם'"): נכנסים אליו מהבאנר בפס הקידום של עמוד הבית.
 * *** תיקון (בקשה מפורשת): רק מקומות שמשתמשים העלו / דירגו / שיתפו (ר' /api/hot), וכותרת רגילה
 * כמו בעמוד "הבחירות שלי" במקום הבאנר.
 * המקומות הכי פעילים בקהילה ב-30 הימים האחרונים:
 *  באנר -> סינון לפי סוג (אותם 6 סוגים ואייקונים של האפליקציה) -> "#1 עכשיו" גדול -> טיולים שכולם
 *  שומרים (ב"הכל") -> דירוג 2..30 עם מספר המקום, אהבות ודירוג.
 * שפה: כמו שאר האפליקציה (לבן, Rubik, כחול לבחירה), עם הכתום של הבאנר רק למספרי הדירוג ולתג "#1".
 * מטמון בזיכרון לכל קטגוריה ל-5 דקות - מעבר בין סינונים או חזרה מעמוד מקום לא טוענים מחדש.
 */

type Filter = "all" | HomeQuickCategoryId;

const FILTER_LABELS: Record<Filter, string> = {
  all: "הכל",
  attraction: "אטרקציות",
  food: "אוכל",
  shopping: "שופינג",
  nature: "טבע",
  nightlife: "חיי לילה",
  sleep: "לינה",
};

const CATEGORY_WORD: Record<HomeQuickCategoryId, string> = {
  attraction: "אטרקציה",
  food: "אוכל",
  shopping: "שופינג",
  nature: "טבע",
  nightlife: "חיי לילה",
  sleep: "לינה",
};

/** הכתום של הבאנר, כהה מספיק לטקסט על לבן ולטקסט לבן עליו (ניגודיות 4.5:1 ומעלה). */
const HOT = "#C2410C";
const BLUE = "#0A6DFE";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<Filter, { places: HotPlaceItem[]; trips: HotTripItem[]; at: number }>();

function fresh(filter: Filter) {
  const hit = cache.get(filter);
  return hit && Date.now() - hit.at < CACHE_TTL_MS ? hit : null;
}

export default function HotPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<{ places: HotPlaceItem[]; trips: HotTripItem[] } | null>(() => fresh("all"));
  const [failed, setFailed] = useState(false);
  /** "נסו שוב" אחרי כשל - מעלה את המונה כדי להריץ את הטעינה מחדש. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    const hit = fresh(filter);
    if (hit) {
      setData(hit);
      return;
    }
    let cancelled = false;
    setData(null);
    setFailed(false);
    fetch(`/api/hot?category=${filter}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json) => {
        const next = { places: Array.isArray(json.places) ? json.places : [], trips: Array.isArray(json.trips) ? json.trips : [], at: Date.now() };
        cache.set(filter, next);
        if (!cancelled) setData(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, user, attempt]);

  const [top, ...rest] = data?.places ?? [];

  return (
    <div className="min-h-screen bg-white pb-28" style={CREATE_INK}>
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => router.back()} />

      <div className="mx-auto max-w-xl">
        {/* ───── כותרת - אותו סגנון בדיוק כמו "הבחירות שלי" ───── */}
        <header className="px-5 pt-4">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">כל מה שחם</h1>
          <p className="mt-1 text-[14px] text-ink-secondary">המקומות שהקהילה הכי העלתה, דירגה ושיתפה בחודש האחרון.</p>
        </header>

        {/* ───── סינון לפי סוג ───── */}
        <div role="radiogroup" aria-label="סינון לפי סוג" className="stories-rail-track mt-4 flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
          {(["all", ...HOME_QUICK_CATEGORIES.map((c) => c.id)] as Filter[]).map((id) => {
            const selected = filter === id;
            const icon = id === "all" ? null : HOME_QUICK_CATEGORIES.find((c) => c.id === id)?.imageSrc;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setFilter(id)}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-full text-[14px] font-semibold transition active:scale-95 ${icon ? "pe-4 ps-1.5" : "px-4"} ${
                  selected ? "text-white" : "bg-[#F1F2F5] text-ink"
                }`}
                style={selected ? { background: BLUE } : undefined}
              >
                {icon && (
                  <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white">
                    <Image src={icon} alt="" fill sizes="28px" className="object-cover" />
                  </span>
                )}
                {FILTER_LABELS[id]}
              </button>
            );
          })}
        </div>

        {/* ───── תוכן ───── */}
        {failed ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[16px] font-semibold text-ink">לא הצלחנו לטעון את מה שחם</p>
            <p className="mt-1 text-[14px] text-ink-secondary">בדקו את החיבור ונסו שוב.</p>
            <Button type="button" className="mt-5" onClick={() => setAttempt((n) => n + 1)}>
              נסו שוב
            </Button>
          </div>
        ) : data === null ? (
          <HotSkeleton />
        ) : data.places.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[16px] font-semibold text-ink">עוד אין כאן מקומות חמים</p>
            <p className="mt-1 text-[14px] text-ink-secondary">ביקרתם במקום שווה? דרגו אותו או העלו אותו - והוא יופיע כאן.</p>
            <Button href="/places/create" className="mt-5">
              שיתוף מקום
            </Button>
          </div>
        ) : (
          <>
            {top && <FeaturedCard item={top} />}

            {filter === "all" && data.trips.length > 0 && <HotTrips trips={data.trips} />}

            {rest.length > 0 && (
              <section aria-labelledby="hot-list" className="mt-8 px-4">
                <h2 id="hot-list" className="px-1 text-[19px] font-bold text-ink">
                  {filter === "all" ? "עוד מקומות חמים" : `עוד ב${FILTER_LABELS[filter]}`}
                </h2>
                <ol className="mt-2 flex flex-col">
                  {rest.map((item, i) => (
                    <HotRow key={item.id} item={item} rank={i + 2} />
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </div>

      <MainBottomNav active="home" />
    </div>
  );
}

function subtitleOf(item: HotPlaceItem): string {
  return [item.category ? CATEGORY_WORD[item.category] : null, item.city].filter(Boolean).join(" · ");
}

function Star() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#F5B301" aria-hidden="true">
      <path d="M12 2.8l2.84 5.76 6.36.92-4.6 4.49 1.08 6.33L12 17.31l-5.68 2.99 1.08-6.33-4.6-4.49 6.36-.92L12 2.8z" />
    </svg>
  );
}

function ratingsWord(n: number): string {
  return n === 1 ? "דירוג אחד" : `${n} דירוגים`;
}

/** פעילות = דירוג / העלאה / פוסט על המקום. */
function activityWord(n: number): string {
  return n === 1 ? "שיתוף אחד החודש" : `${n} שיתופים החודש`;
}

function Flame({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c.6 3.2-1 5.2-2.6 7-1.5 1.7-2.9 3.3-2.9 6A5.5 5.5 0 0 0 12 20.5 5.5 5.5 0 0 0 17.5 15c0-2.6-1.3-4.5-2.4-5.8-.1 1.6-.8 2.8-2 3.3.6-3.5-.2-7.7-1.1-10.5Z" />
    </svg>
  );
}

function Heart({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 20.6s-7.6-4.7-7.6-10.4A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.6 2.6c0 5.7-7.6 10.4-7.6 10.4Z" />
    </svg>
  );
}

/** "#1 עכשיו" - כרטיס גדול למקום הכי חם. */
function FeaturedCard({ item }: { item: HotPlaceItem }) {
  return (
    <section aria-label="המקום הכי חם עכשיו" className="mt-5 px-4">
      <Link href={`/place/${item.id}`} className="relative block aspect-[4/3] overflow-hidden rounded-[24px] bg-[#EFF1F4] transition active:scale-[0.99]">
        {item.imageUrl && <MediaTile url={item.mediaType === "video" ? item.imageUrl : optimizeImage(item.imageUrl, 800)} video={item.mediaType === "video"} />}
        <span className="absolute end-3 top-3 flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-white" style={{ background: HOT }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2c.6 3.2-1 5.2-2.6 7-1.5 1.7-2.9 3.3-2.9 6A5.5 5.5 0 0 0 12 20.5 5.5 5.5 0 0 0 17.5 15c0-2.6-1.3-4.5-2.4-5.8-.1 1.6-.8 2.8-2 3.3.6-3.5-.2-7.7-1.1-10.5Z" />
          </svg>
          #1 עכשיו
        </span>
        <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.8)_0%,rgba(0,0,0,.4)_55%,transparent_100%)] px-4 pb-4 pt-16">
          <span className="block text-[22px] font-bold leading-tight text-white">{item.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-white/90">
            {subtitleOf(item) && <span>{subtitleOf(item)}</span>}
            {item.communityRating != null && (
              <span className="flex items-center gap-1">
                <Star />
                {item.communityRating.toFixed(1)}
                <span className="text-white/75">({ratingsWord(item.ratingCount)})</span>
              </span>
            )}
            {item.recentCount > 0 && (
              <span className="flex items-center gap-1">
                <Flame />
                {activityWord(item.recentCount)}
              </span>
            )}
          </span>
        </span>
      </Link>
    </section>
  );
}

/** שורה בדירוג: מספר, תמונה, שם, סוג ועיר, דירוג ואהבות. */
function HotRow({ item, rank }: { item: HotPlaceItem; rank: number }) {
  return (
    <li>
      <Link href={`/place/${item.id}`} className="flex items-center gap-3 rounded-[18px] px-1 py-2.5 transition active:bg-[#F7F8FA]">
        <span
          className="w-8 shrink-0 text-center text-[20px] font-bold tabular-nums"
          style={{ color: rank <= 3 ? HOT : "#9aa1ad" }}
          aria-label={`מקום ${rank}`}
        >
          {rank}
        </span>
        <span className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[16px] bg-[#EFF1F4]">
          {item.imageUrl ? (
            <MediaTile url={item.mediaType === "video" ? item.imageUrl : optimizeImage(item.imageUrl, 200)} video={item.mediaType === "video"} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[#9aa1ad]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11Z" />
                <circle cx="12" cy="10" r="2.3" />
              </svg>
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold text-ink">{item.name}</span>
          {subtitleOf(item) && <span className="mt-0.5 block truncate text-[13px] text-ink-secondary">{subtitleOf(item)}</span>}
          <span className="mt-1 flex items-center gap-3 text-[13px] font-medium text-ink">
            {item.communityRating != null && (
              <span className="flex items-center gap-1">
                <Star />
                {item.communityRating.toFixed(1)}
                <span className="font-normal text-ink-secondary">({ratingsWord(item.ratingCount)})</span>
              </span>
            )}
            {item.recentCount > 0 && (
              <span className="flex items-center gap-1" style={{ color: HOT }}>
                <Flame size={13} />
                {activityWord(item.recentCount)}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** טיולים שכולם שומרים - שורה אופקית. */
function HotTrips({ trips }: { trips: HotTripItem[] }) {
  return (
    <section aria-labelledby="hot-trips" className="mt-8">
      <h2 id="hot-trips" className="px-5 text-[19px] font-bold text-ink">
        טיולים שכולם שומרים
      </h2>
      <div className="stories-rail-track mt-3 flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
        {trips.map((trip) => (
          <Link key={trip.id} href={`/places/trip/${trip.id}`} className="w-[200px] shrink-0 rounded-[20px] bg-[#F7F8FA] p-2 transition active:scale-[0.98]">
            <span className="relative block aspect-[4/3] overflow-hidden rounded-[14px] bg-[#EFF1F4]">
              {trip.imageUrl && <MediaTile url={optimizeImage(trip.imageUrl, 420)} />}
            </span>
            <span className="block px-1 pb-1 pt-2">
              <span className="block truncate text-[15px] font-semibold text-ink">{trip.title}</span>
              <span className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink-secondary">
                {trip.stopCount === 1 ? "תחנה אחת" : `${trip.stopCount} תחנות`}
                <span className="flex items-center gap-1 font-medium" style={{ color: HOT }}>
                  <Heart size={12} />
                  {trip.score}
                </span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HotSkeleton() {
  return (
    <div aria-busy="true" aria-label="טוען" className="px-4">
      <div className="mt-5 aspect-[4/3] w-full animate-pulse rounded-[24px] bg-[#EFF1F4]" />
      <div className="mt-8 flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-1">
            <span className="h-5 w-8 animate-pulse rounded bg-[#F4F5F7]" />
            <span className="h-[72px] w-[72px] animate-pulse rounded-[16px] bg-[#EFF1F4]" />
            <span className="flex flex-1 flex-col gap-2">
              <span className="h-4 w-2/3 animate-pulse rounded bg-[#EFF1F4]" />
              <span className="h-3 w-1/3 animate-pulse rounded bg-[#F4F5F7]" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
