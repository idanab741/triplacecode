"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
const STEP = NARROW + GAP;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"; // smooth "settle" easing, not linear

/** מקטע "יעדים חמים": כרטיס אחד "פתוח" במרכז עם כיתוב בתוך התמונה, השאר "סגורים".
 *  הגודל משתנה רק אחרי שהגלילה נעצרת (לא באופן רציף תוך כדי גרירה). */
export function HotDestinations({ title, destinations }: HotDestinationsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const labelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const N = destinations.length;
  const loop = N > 1 ? [...destinations, ...destinations] : destinations;

  function markLoaded(id: string) {
    setLoadedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  // sets the open/closed state for whichever index is currently focused —
  // called only once scrolling has settled, never on every scroll frame
  function settle(focusedIndex: number) {
    loop.forEach((_, i) => {
      const isFocused = i === focusedIndex;
      const card = cardRefs.current[i];
      const label = labelRefs.current[i];
      if (card) {
        card.style.width = `${isFocused ? WIDE : NARROW}px`;
        card.style.transform = isFocused ? "translateY(-2px)" : "translateY(0)";
        card.style.boxShadow = isFocused
          ? "0 14px 28px -8px rgba(16,24,40,.28)"
          : "0 3px 10px -2px rgba(16,24,40,.14)";
      }
      if (label) label.style.opacity = isFocused ? "1" : "0";
    });
  }

  function onScroll() {
    if (N <= 1) return;
    clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const raw = el.scrollLeft;
      const sign = Math.sign(raw || -1);
      let idx = Math.round(Math.abs(raw) / STEP);
      if (idx >= N) {
        // seamlessly jump back to the identical card in the first copy — no visible reset
        idx -= N;
        el.scrollLeft = sign * idx * STEP;
      } else {
        el.scrollTo({ left: sign * idx * STEP, behavior: "smooth" });
      }
      settle(idx);
    }, 120);
  }

  useEffect(() => { settle(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          className="flex items-start gap-2 overflow-x-auto pb-3 pt-1"
          style={{ scrollbarWidth: "none" }}
        >
          {loop.map((destination, i) => {
            const isLoaded = loadedIds.has(destination.id + "-" + i);
            return (
              <div
                key={destination.id + "-" + i}
                ref={(el) => { cardRefs.current[i] = el; }}
                className="shrink-0 rounded-card"
                style={{
                  width: i === 0 ? WIDE : NARROW,
                  transition: `width 320ms ${EASE}, transform 320ms ${EASE}, box-shadow 320ms ${EASE}`,
                  boxShadow: i === 0
                    ? "0 14px 28px -8px rgba(16,24,40,.28)"
                    : "0 3px 10px -2px rgba(16,24,40,.14)",
                }}
              >
                <Link
                  href={`/destination/${destination.id}`}
                  className="relative block h-52 overflow-hidden rounded-card bg-bg-secondary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={destination.imageUrl}
                    alt={destination.name}
                    onLoad={() => markLoaded(destination.id + "-" + i)}
                    className="h-full w-full object-cover transition-opacity duration-500 ease-out"
                    style={{ opacity: isLoaded ? 1 : 0 }}
                  />

                  {destination.matchScore != null && (
                    <span className="absolute start-2 top-2 whitespace-nowrap rounded-pill bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] px-2.5 py-1 text-[11px] font-bold tracking-tight text-white shadow-soft">
                      {destination.matchScore}% התאמה
                    </span>
                  )}

                  {/* caption is overlaid INSIDE the photo, bottom gradient */}
                  <div
                    ref={(el) => { labelRefs.current[i] = el; }}
                    className="pointer-events-none absolute inset-x-0 bottom-0 whitespace-nowrap bg-[linear-gradient(0deg,rgba(0,0,0,.7)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-3 pt-11 text-center opacity-0"
                    style={{ transition: `opacity 280ms ${EASE}` }}
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
          <span className="shrink-0" style={{ width: "40%" }} />
        </div>
      )}
    </div>
  );
}
