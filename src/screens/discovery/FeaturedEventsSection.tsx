"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";
import "swiper/css";
import "swiper/css/pagination";
import type { DiscoveryEvent } from "@/services/places/discoveryService";

interface FeaturedEventsSectionProps {
  events: DiscoveryEvent[];
}

function formatDateRange(event: DiscoveryEvent): string {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const fmt = (d: Date) => d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
  if (event.startDate === event.endDate) return fmt(start);
  return `${fmt(start)} - ${fmt(end)}`;
}

/**
 * "אירועים ופסטיבלים" (Audit מול "PROMPT 1" סעיף 8): **לא** משתמש
 * ב-DiscoveryPlaceCard הרגיל - כרטיס Featured גדול, ממחזר במדויק את
 * השפה הוויזואלית והמידות של DiscoverCard.tsx הקיים ("גלה עוד" בדף
 * הבית: Swiper, rounded-[30px], shadow-xl, סליידים ברוחב מלא) - כי זו
 * בדיוק הדרישה המפורשת ("FEATURED CONTENT, לא עוד Place Card קטן").
 * EMPTY STATE: אם אין אירועים פעילים/קרובים למיקום - הסקשן כולו לא
 * מוצג (לא כרטיס "אין אירועים" ריק).
 */
export function FeaturedEventsSection({ events }: FeaturedEventsSectionProps) {
  if (events.length === 0) return null;

  // אותו תרגיל בדיוק כמו DiscoverCard.tsx - Swiper עם loop משכפל סליידים
  // ב-DOM ישירות בלי event handlers, אז הקליק חייב להיות ברמת ה-Swiper
  // עם data-swiper-slide-index, לא Link רגיל על כל סליים.
  function handleClick(_swiper: SwiperInstance, event: MouseEvent | TouchEvent | PointerEvent) {
    const target = event.target as HTMLElement | null;
    const slideEl = target?.closest("[data-swiper-slide-index]") as HTMLElement | null;
    const indexAttr = slideEl?.getAttribute("data-swiper-slide-index");
    if (indexAttr == null) return;
    const ev = events[Number(indexAttr)];
    if (ev?.linkUrl) {
      window.open(ev.linkUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <section className="px-6">
      <h3 className="mb-3 text-lg font-semibold text-ink">🎪 אירועים ופסטיבלים</h3>

      <Swiper
        modules={[Autoplay, Pagination]}
        slidesPerView={1}
        spaceBetween={0}
        loop={events.length > 1}
        autoplay={events.length > 1 ? { delay: 6000, disableOnInteraction: false } : false}
        pagination={{ clickable: true }}
        onClick={handleClick}
        className="rounded-[30px] shadow-xl"
      >
        {events.map((event) => (
          <SwiperSlide key={event.id} className={event.linkUrl ? "cursor-pointer" : undefined}>
            <div className="relative">
              {event.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={event.imageUrl} alt={event.title} className="block h-auto w-full" />
              ) : (
                <div className="flex h-[220px] w-full items-center justify-center bg-bg-secondary text-4xl">🎪</div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.8)_0%,rgba(0,0,0,.4)_55%,transparent_100%)] p-5 pt-16">
                <p className="text-xs font-bold text-white/90">{formatDateRange(event)}</p>
                <p className="truncate text-xl font-bold text-white">{event.title}</p>
                {event.locationLabel && <p className="truncate text-sm text-white/85">{event.locationLabel}</p>}
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
