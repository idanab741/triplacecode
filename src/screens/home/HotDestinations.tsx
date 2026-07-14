"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

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

const NARROW = 58;   // collapsed strip width, px — smaller so more cards fit on a phone
const WIDE = 220;     // expanded (focused) card width, px — smaller than before
const GAP = 8;
const STEP = NARROW + GAP;

/** מקטע "יעדים חמים": כרטיס אחד "פתוח" במרכז עם כיתוב מתחת לתמונה, השאר "סגורים".
 *  הגודל משתנה רק אחרי שהגלילה נעצרת (לא באופן רציף תוך כדי גרירה). */
export function HotDestinations({ title, destinations }: HotDestinationsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const labelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const N = destinations.length;
  const loop = N > 1 ? [...destinations, ...destinations] : destinations;

  // sets the open/closed state for whichever index is currently focused —
  // called only once scrolling has settled, never on every scroll frame
  function settle(focusedIndex: number) {
    loop.forEach((_, i) => {
      const isFocused = i === focusedIndex;
      const card = cardRefs.current[i];
      const label = labelRefs.current[i];
      if (card) card.style.width = `${isFocused ? WIDE : NARROW}px`;
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
      <h3 className="mb-3 text-lg font-semibold text-ink">{title}</h3>

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
          className="flex items-start gap-2 overflow-x-auto pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {loop.map((destination, i) => (
            <div
              key={destination.id + "-" + i}
              ref={(el) => { cardRefs.current[i] = el; }}
              className="shrink-0 transition-[width] duration-300 ease-out"
              style={{ width: i === 0 ? WIDE : NARROW }}
            >
              <Link
                href={`/destination/${destination.id}`}
                className="relative block h-52 overflow-hidden rounded-card shadow-soft"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={destination.imageUrl}
                  alt={destination.name}
                  className="h-full w-full object-cover"
                />
                {destination.matchScore != null && (
                  <span className="absolute start-2 top-2 whitespace-nowrap rounded-pill bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] px-2.5 py-1 text-xs font-bold text-white shadow-soft">
                    {destination.matchScore}% התאמה
                  </span>
                )}

                {/* caption is overlaid INSIDE the photo, bottom gradient */}
                <div
                  ref={(el) => { labelRefs.current[i] = el; }}
                  className="pointer-events-none absolute inset-x-0 bottom-0 whitespace-nowrap bg-[linear-gradient(0deg,rgba(0,0,0,0.65),transparent)] p-3 pt-10 text-center opacity-0 transition-opacity duration-300 ease-out"
                >
                  <p className="text-base font-bold text-white">{destination.name}</p>
                  {destination.subtitle && (
                    <p className="text-xs text-white/85">{destination.subtitle}</p>
                  )}
                  {destination.matchReason && (
                    <p className="mt-0.5 truncate text-xs text-white/70">{destination.matchReason}</p>
                  )}
                </div>
              </Link>
            </div>
          ))}
          <span className="shrink-0" style={{ width: "40%" }} />
        </div>
      )}
    </div>
  );
}