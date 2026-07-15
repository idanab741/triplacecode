"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

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

const NARROW = 58;   // collapsed strip width, px
const WIDE = 220;     // expanded (focused) card width, px
const GAP = 8;
const SWIPE_THRESHOLD = 35; // px of horizontal drag needed to count as a swipe
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** מקטע "יעדים חמים": כרטיס אחד "פתוח" במרכז, 2 "סגורים" נראים מכל צד.
 *  אין יותר גלילה חופשית של הדפדפן — כל החלקה מזיזה **צעד אחד בדיוק**
 *  (index אחד קדימה/אחורה), נשלט לגמרי בקוד. זה מבטל את כל הבעיות של
 *  "המרה" בין מיקום גלילה גולמי לאינדקס לוגי, שהיו הגורם לקפיצות. */
export function HotDestinations({ title, destinations }: HotDestinationsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const dragStartX = useRef(0);
  const dragging = useRef(false);
  const N = destinations.length;

  function markLoaded(key: string) {
    setLoadedIds((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }

  function step(dir: 1 | -1) {
    if (N <= 1) return;
    setFocusedIndex((i) => (i + dir + N) % N);
  }

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    dragStartX.current = e.clientX;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current = false;
    const delta = e.clientX - dragStartX.current;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    // RTL: dragging left (negative delta) moves to the next card, dragging right goes back
    step(delta < 0 ? 1 : -1);
  }

  // window of exactly 2 collapsed neighbors on each side + the focused card
  const visible = useMemo(() => {
    if (N === 0) return [];
    const offsets = N > 4 ? [-2, -1, 0, 1, 2] : Array.from({ length: N }, (_, k) => k - Math.floor(N / 2));
    return offsets.map((off) => {
      const idx = ((focusedIndex + off) % N + N) % N;
      return { destination: destinations[idx], idx, off, isFocused: off === 0 };
    });
  }, [destinations, focusedIndex, N]);

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
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="flex touch-pan-y items-start justify-center gap-2 select-none"
          style={{ cursor: "grab" }}
        >
          {visible.map(({ destination, idx, off, isFocused }) => {
            const key = destination.id + "-slot-" + idx;
            const isLoaded = loadedIds.has(key);
            return (
              <div
                key={key}
                className="shrink-0 rounded-card"
                style={{
                  width: isFocused ? WIDE : NARROW,
                  transform: isFocused ? "translateY(-2px)" : "translateY(0)",
                  boxShadow: isFocused
                    ? "0 14px 28px -8px rgba(16,24,40,.28)"
                    : "0 3px 10px -2px rgba(16,24,40,.14)",
                  transition: `width 300ms ${EASE}, transform 300ms ${EASE}, box-shadow 300ms ${EASE}`,
                }}
              >
                <Link
                  href={`/destination/${destination.id}`}
                  onClick={(e) => {
                    // tapping a side (collapsed) card just brings it into focus — doesn't navigate yet
                    if (!isFocused) { e.preventDefault(); step(off < 0 ? -1 : 1); }
                  }}
                  className="relative block h-52 overflow-hidden rounded-card bg-bg-secondary"
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

                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 whitespace-nowrap bg-[linear-gradient(0deg,rgba(0,0,0,.7)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-3 pt-11 text-center"
                    style={{ opacity: isFocused ? 1 : 0, transition: `opacity 260ms ${EASE}` }}
                  >
                    <p className="text-base font-bold leading-tight text-white">{destination.name}</p>
                    {destination.subtitle && (
                      <p className="text-xs text-white/85">{destination.subtitle}</p>
                    )}
                    {destination.matchReason && (
                      <p className="mt-0.5 truncate text-xs text-white/70">{destination.matchReason}</p>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {N > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {destinations.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === focusedIndex ? 16 : 6,
                backgroundColor: i === focusedIndex ? "var(--color-primary-start)" : "var(--color-ink-secondary)",
                opacity: i === focusedIndex ? 1 : 0.3,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}