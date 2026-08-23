"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { IsraelVacationDestination } from "@/constants/israelVacationDestinations";

interface VacationDestinationsCarouselProps {
  title: string;
  destinations: IsraelVacationDestination[];
}

/**
 * "🔥 היעדים החמים" של חופשה בארץ (Audit - "רוצה קרוסלה כמו שיש בעמוד
 * הבית 'מותאם בשבילך' - באותו סגנון בדיוק"): מחזר בכוונה את כל השפה
 * הוויזואלית של HotDestinations.tsx (Embla, כרטיס-מרכז מתרחב, גרדיאנט,
 * שם על גבי התמונה) - **לא** את הרכיב עצמו, כי ה-href שם מקובע ל-
 * `/destination/[id]` (מקושר ל-destinations table UUID אמיתי) - כאן
 * היעדים סטטיים (constants/israelVacationDestinations.ts) עם slug
 * קבוע, לא ID מה-DB, ומובילים לעמוד יעד ייעודי לחופשה בארץ (עם
 * אטרקציות/מלונות/וכו', לא לעמוד /destination הכללי).
 *
 * placeholder עדין ("תמונות שקופות - תכף אשלח את כל התמונות") כשאין
 * imageUrl עדיין - גרדיאנט + שם היעד, לא תמונה שבורה/ריקה.
 */
export function VacationDestinationsCarousel({ title, destinations }: VacationDestinationsCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: destinations.length > 1,
    direction: "rtl",
    align: "center",
    containScroll: false,
    dragFree: false,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (!emblaApi) return;
    const id = setTimeout(() => emblaApi.reInit(), 320); // אחרי שאנימציית ה-CSS של הרוחב מסתיימת
    return () => clearTimeout(id);
  }, [emblaApi, selectedIndex]);

  if (destinations.length === 0) return null;

  return (
    <div className="px-6">
      <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink">{title}</h3>

      <div className="-mx-6 overflow-hidden px-6" ref={emblaRef}>
        <div className="flex">
          {destinations.map((destination, i) => {
            const isFocused = i === selectedIndex;
            return (
              <div
                key={destination.slug}
                className="min-w-0 shrink-0 grow-0 transition-[flex-basis] duration-300 ease-out"
                style={{
                  flexBasis: isFocused ? 230 : 48,
                  zIndex: isFocused ? 2 : 1,
                  marginInlineEnd: 8,
                }}
              >
                <Link
                  href={`/trip-builder/weekend/discover/destination/${destination.slug}`}
                  className="relative block h-[180px] overflow-hidden rounded-card shadow-soft"
                >
                  {destination.imageUrl && !failedIds.has(destination.slug) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={destination.imageUrl}
                      alt={destination.name}
                      onError={() => setFailedIds((prev) => new Set(prev).add(destination.slug))}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-[linear-gradient(135deg,var(--color-primary-start)/0.35,var(--color-primary-end)/0.2)] bg-bg-secondary" />
                  )}

                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 whitespace-nowrap bg-[linear-gradient(0deg,rgba(0,0,0,.7)_0%,rgba(0,0,0,.3)_60%,transparent_100%)] p-2 pt-8 text-center transition-opacity duration-300"
                    style={{ opacity: isFocused ? 1 : 0 }}
                  >
                    <p className="truncate text-sm font-bold leading-tight text-white">{destination.name}</p>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
