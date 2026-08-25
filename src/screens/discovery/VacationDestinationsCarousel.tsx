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
 * שם על גבי התמונה).
 *
 * תיקון Product מפורש ("שכל יעד יוביל לעמוד שלו - בסגנון של יעד בחו''ל
 * (התמונה, מזג האוויר וכו')"): קליק מוביל עכשיו ל-/destination/[id]
 * הכללי (אותו עמוד בדיוק כמו יעדי "חופשה בחו''ל" - hero, WeatherRow,
 * EventsRow, PlaceRow) במקום לעמוד ה-Discovery הישן (weekend/discover/
 * destination/[slug]). מתאם slug->UUID לפי שם דרך
 * /api/discovery/israel-vacation-destinations (אותו דפוס בדיוק כמו
 * worldwide-categories). כרטיס בלי התאמה (עדיין לא נטען/לא נמצא) -
 * עדיין מוצג, פשוט לא לחיץ (לא נעלם, לא שגיאה) - עקבי עם
 * WorldwideCategorySection.tsx.
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
  const [destinationIdBySlug, setDestinationIdBySlug] = useState<Record<string, string | null>>({});

  useEffect(() => {
    fetch("/api/discovery/israel-vacation-destinations")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setDestinationIdBySlug(json?.matches ?? {}))
      .catch(() => setDestinationIdBySlug({}));
  }, []);


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
            const destinationId = destinationIdBySlug[destination.slug];
            const href = destinationId ? `/destination/${destinationId}` : null;
            const cardContent = (
              <>
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
              </>
            );
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
                {href ? (
                  <Link href={href} className="relative block h-[180px] overflow-hidden rounded-card shadow-soft">
                    {cardContent}
                  </Link>
                ) : (
                  <div className="relative block h-[180px] overflow-hidden rounded-card shadow-soft">{cardContent}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
