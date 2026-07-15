"use client";

import Link from "next/link";
import { useRef, useState } from "react";

export interface Destination {
  id: string;
  name: string;
  subtitle: string | null;
  imageUrl: string;
  matchScore?: number;
  matchReason?: string;
}

interface HotDestinationsProps {
  title: string;
  destinations: Destination[];
}

const CARD_W = 172; // uniform card width, px
const GAP = 10;

/** מקטע "יעדים חמים": כרטיסים אחידים, גלילה טבעית של הדפדפן (scroll-snap),
 *  עד קצה המסך (edge-to-edge). זו הגרסה היציבה שכבר אישרנו שמציגה תמונות. */
export function HotDestinations({ title, destinations }: HotDestinationsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const N = destinations.length;
  const loop = N > 1 ? [...destinations, ...destinations] : destinations;
  const STEP = CARD_W + GAP;

  function markLoaded(key: string) {
    setLoadedIds((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }

  function onScroll() {
    if (N <= 1) return;
    clearTimeout(wrapTimer.current);
    wrapTimer.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const raw = el.scrollLeft;
      const sign = Math.sign(raw || -1);
      const idx = Math.round(Math.abs(raw) / STEP);
      if (idx >= N) el.scrollLeft = sign * (idx - N) * STEP;
    }, 150);
  }

  return (
    <div className="px-6">
      <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink">{title}</h3>

      {destinations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-card bg-bg-secondary px-6 py-10 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-secondary)" strokeWidth="1.5">
            <path d="M12 22s7-6.5 7-12A7 7 0 0 0 5 10c0 5.5 7 12 7 12Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <p className="text-sm font-medium text-ink">יעדים חמים בדרך אליכם!</p>
          <p className="text-xs text-ink-secondary">בקרוב נציג כאן המלצות מותאמות אישית</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="-mx-6 flex gap-2.5 overflow-x-auto px-6 pb-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none" }}
        >
          {loop.map((destination, i) => {
            const key = destination.id + "-" + i;
            const isLoaded = loadedIds.has(key);
            return (
              <Link
                key={key}
                href={`/destination/${destination.id}`}
                className="relative block h-56 shrink-0 snap-start overflow-hidden rounded-card bg-bg-secondary shadow-soft"
                style={{ width: CARD_W }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={destination.imageUrl}
                  alt={destination.name}
                  onLoad={() => markLoaded(key)}
                  className="h-full w-full object-cover transition-opacity duration-500 ease-out"
                  style={{ opacity: isLoaded ? 1 : 0 }}
                />

                {destination.matchScore != null && (
                  <span className="absolute start-2 top-2 whitespace-nowrap rounded-pill bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] px-2.5 py-1 text-[11px] font-bold tracking-tight text-white shadow-soft">
                    {destination.matchScore}% התאמה
                  </span>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.72)_0%,rgba(0,0,0,.3)_60%,transparent_100%)] p-3 pt-10 text-center">
                  <p className="truncate text-base font-bold leading-tight text-white">{destination.name}</p>
                  {destination.subtitle && (
                    <p className="truncate text-xs text-white/85">{destination.subtitle}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}