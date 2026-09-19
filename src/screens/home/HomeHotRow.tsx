"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HomeSectionHeader } from "@/screens/home/HomeSectionHeader";
import { Skeleton } from "@/components/ui";

/**
 * *** חדש (בקשה מפורשת - "כל מה שחם" עם אייקון האש, "תמצא אטרקציות אהובות"):
 * שורת כרטיסיות אופקית של האטרקציות שהכי אהבו/שמרו לאחרונה (ר'
 * /api/home/hot-places). לחיצה על כרטיסייה פותחת את עמוד המקום.
 * מטמון בזיכרון ל-5 דקות - חזרה לעמוד הבית (למשל מעמוד מקום) לא טוענת מחדש
 * ולא מהבהבת. אם אין אף תוצאה - הקטע לא מוצג בכלל.
 */
interface HotItem {
  id: string;
  name: string;
  imageUrl: string;
  city: string | null;
  rating: number | null;
  ratingCount: number | null;
  likes: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { items: HotItem[]; at: number } | null = null;

const CARD_CLASS = "relative block h-[176px] w-[132px] shrink-0 overflow-hidden rounded-card bg-bg-secondary shadow-soft";

export function HomeHotRow() {
  const [items, setItems] = useState<HotItem[] | null>(() => (cache && Date.now() - cache.at < CACHE_TTL_MS ? cache.items : null));

  useEffect(() => {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return;
    let cancelled = false;
    fetch("/api/home/hot-places")
      .then((res) => res.json())
      .then((data) => {
        const list: HotItem[] = Array.isArray(data.items) ? data.items : [];
        cache = { items: list, at: Date.now() };
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items !== null && items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <HomeSectionHeader iconSrc="/images/home/section-hot.webp" title="כל מה שחם" />

      <div className="stories-rail-track flex gap-3 overflow-x-auto px-5 pb-2" style={{ scrollbarWidth: "none" }}>
        {items === null &&
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[176px] w-[132px] shrink-0 rounded-card" />)}

        {items?.map((item) => (
          <Link key={item.id} href={`/place/${item.id}`} className={`${CARD_CLASS} transition active:scale-[0.97]`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" draggable={false} />
            {item.likes > 0 && (
              <div className="absolute left-2 top-2 flex items-center gap-1 rounded-pill bg-black/40 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                <span aria-hidden="true">❤️</span>
                {item.likes}
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.78)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2.5 pt-10">
              <p className="line-clamp-2 text-sm font-bold leading-tight text-white">{item.name}</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-white/90">
                {item.rating != null && (
                  <>
                    <span className="text-[#FFC94A]">★</span>
                    {item.rating.toFixed(1)}
                  </>
                )}
                {item.rating != null && item.city && <span className="opacity-60">·</span>}
                {item.city}
              </p>
            </div>
          </Link>
        ))}

        <div aria-hidden="true" className="w-1 shrink-0" />
      </div>
    </section>
  );
}
