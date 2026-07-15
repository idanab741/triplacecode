"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

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

const NARROW = 64;   // collapsed strip width, px — a bit bigger than before
const WIDE = 240;     // expanded (focused) card width, px — a bit bigger than before
const GAP = 8;
const STEP = NARROW + GAP;
const SWIPE_THRESHOLD = 35;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
// if a swipe ever turns out to move the wrong direction, flip this to -1 — nothing else needs to change
const RTL_SIGN = 1;

/** מקטע "יעדים חמים": כרטיס פתוח במרכז, שכנים סגורים מסביב (אפשר כמה שנכנס,
 *  גם חתוכים בקצה המסך — אין הגבלה למספר קבוע). המיקום נגזר ישירות מ-state
 *  (transform: translateX), בלי גלילה חופשית ובלי מדידה — אין יותר "רץ לבד". */
export function HotDestinations({ title, destinations }: HotDestinationsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const dragStartX = useRef(0);
  const dragging = useRef(false);
  const N = destinations.length;

  // triple copy: a full buffer on each side of the "real" middle copy, so
  // peeking neighbors are always correct with zero special-case wrap logic
  const strip = useMemo(
    () => (N > 0 ? [...destinations, ...destinations, ...destinations] : []),
    [destinations, N]
  );
  const focusedGlobalIndex = N + focusedIndex; // position of the focused card inside `strip`

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
    step((delta > 0 ? 1 : -1) * RTL_SIGN as 1 | -1);
  }

  // measure the real container width AFTER the browser has actually laid
  // it out — reading a ref's clientWidth during render itself can return 0
  // (before layout happens), and with overflow:hidden a 0-width box shows
  // ABSOLUTELY NOTHING, no matter what's inside it. This was the bug.
  const [containerW, setContainerW] = useState(0);
  useLayoutEffect(() => {
    function measure() {
      if (containerRef.current) setContainerW(containerRef.current.clientWidth);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // every card before the focused one in `strip` is NARROW (the focused
  // card is the only WIDE one in the entire strip), so the offset to reach
  // it is a simple, exact multiple — no measuring, no rounding drift
  const offsetToFocused = focusedGlobalIndex * STEP;
  const ready = containerW > 0;
  const translateX = ready ? containerW / 2 - offsetToFocused - WIDE / 2 : 0;

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
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="-mx-6 min-h-[208px] w-full overflow-hidden px-6 select-none"
          style={{ touchAction: "pan-y", cursor: "grab" }}
        >
          {/* TEMPORARY DEBUG LINE — tells us the real numbers instead of guessing.
              Delete this <p> once the carousel is confirmed working. */}
          <p style={{ fontSize: 11, color: "red", background: "#fff", padding: 2 }}>
            DEBUG: containerW={containerW} ready={String(ready)} N={N} stripLen={strip.length} translateX={Math.round(translateX)}
          </p>
          <div
            className="flex items-start gap-2"
            style={{
              transform: `translateX(${translateX}px)`,
              transition: ready ? `transform 320ms ${EASE}` : "none",
              opacity: ready ? 1 : 0,
              width: "max-content",
            }}
          >
            {strip.map((destination, gi) => {
              const isFocused = gi === focusedGlobalIndex;
              const key = destination.id + "-pos-" + gi;
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
                    transition: `width 320ms ${EASE}, transform 320ms ${EASE}, box-shadow 320ms ${EASE}`,
                  }}
                >
                  <Link
                    href={`/destination/${destination.id}`}
                    onClick={(e) => {
                      if (!isFocused) { e.preventDefault(); step(gi < focusedGlobalIndex ? -1 : 1); }
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