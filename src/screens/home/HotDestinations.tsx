"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

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

/** מקטע "יעדים חמים": כרטיס אחד "פתוח"/מוגדל במרכז, השאר "סגורים" קטנים
 *  יותר סביבו. הגלילה/ההצמדה/הלולאה עצמן מנוהלות ע"י Embla Carousel
 *  (ספרייה בדוקה) — אנחנו רק שואלים אותה "איזה כרטיס במרכז עכשיו"
 *  ומוסיפים לו קלאס שמגדיל אותו. */
export function HotDestinations({ title, destinations }: HotDestinationsProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: destinations.length > 1,
    direction: "rtl",
    align: "center",
    containScroll: false,
    dragFree: false,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // the open/closed card widths change with selectedIndex — Embla caches
  // slide sizes internally, so it must be told to re-measure every time
  // that happens, or its snap points would drift out of sync with what's
  // actually on screen
  useEffect(() => {
    if (!emblaApi) return;
    const id = setTimeout(() => emblaApi.reInit(), 320); // after the width CSS transition finishes
    return () => clearTimeout(id);
  }, [emblaApi, selectedIndex]);

  function markLoaded(key: string) {
    setLoadedIds((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
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
        <div className="-mx-6 overflow-hidden px-6" ref={emblaRef}>
          <div className="flex gap-2">
            {destinations.map((destination, i) => {
              const isFocused = i === selectedIndex;
              const key = destination.id + "-" + i;
              const isLoaded = loadedIds.has(key);
              return (
                <div
                  key={key}
                  className="min-w-0 shrink-0 grow-0 transition-[flex-basis] duration-300 ease-out"
                  style={{ flexBasis: isFocused ? 200 : 42, zIndex: isFocused ? 2 : 1 }}
                >
                  <Link
                    href={`/destination/${destination.id}`}
                    className="relative block h-40 overflow-hidden rounded-card bg-bg-secondary shadow-soft"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={destination.imageUrl}
                      alt={destination.name}
                      onLoad={() => markLoaded(key)}
                      className="h-full w-full object-cover transition-opacity duration-500 ease-out"
                      style={{ opacity: isLoaded ? 1 : 0 }}
                    />

                    {destination.matchScore != null && isFocused && (
                      <span className="absolute start-2 top-2 whitespace-nowrap rounded-pill bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] px-2 py-0.5 text-[10px] font-bold tracking-tight text-white shadow-soft">
                        {destination.matchScore}% התאמה
                      </span>
                    )}

                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 whitespace-nowrap bg-[linear-gradient(0deg,rgba(0,0,0,.7)_0%,rgba(0,0,0,.3)_60%,transparent_100%)] p-2 pt-8 text-center transition-opacity duration-300"
                      style={{ opacity: isFocused ? 1 : 0 }}
                    >
                      <p className="truncate text-sm font-bold leading-tight text-white">{destination.name}</p>
                      {destination.subtitle && (
                        <p className="truncate text-[10px] text-white/85">{destination.subtitle}</p>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}