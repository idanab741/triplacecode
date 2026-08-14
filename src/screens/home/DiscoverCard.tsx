"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";

import "swiper/css";
import "swiper/css/pagination";

const SLIDES = [
  {
    href: "/tripmatch",
    image: "/images/discover/tripmatch.png",
    alt: "TripMatch",
  },
  {
    href: "/test-game",
    image: "/images/discover/game.png",
    alt: "המשחק שלנו",
  },
  {
    href: "/ai",
    image: "/images/discover/ai-powered.png",
    alt: "AI Powered",
  },
  {
    href: "/community",
    image: "/images/discover/places.png",
    alt: "Places",
  },
];

export function DiscoverCard() {
  const router = useRouter();

  // לא ניתן להשתמש כאן ב-next/link רגיל: כש-loop מופעל, Swiper משכפל
  // את אלמנטי הסליידים ב-DOM ישירות (לא דרך React) כדי ליצור לולאה
  // חלקה - לשכפולים האלה אין event handlers מצורפים, אז קליק עליהם
  // (שקורה בפועל רוב הזמן, כי הלולאה מציגה כל הזמן שכפולים) לא עושה
  // כלום. הפתרון: onClick ברמת ה-Swiper עצמו, שמזהה נכון גם שכפולים
  // דרך data-swiper-slide-index (attribute שמצביע תמיד לאינדקס המקורי).
  function handleClick(_swiper: SwiperInstance, event: MouseEvent | TouchEvent | PointerEvent) {
    const target = event.target as HTMLElement | null;
    const slideEl = target?.closest("[data-swiper-slide-index]") as HTMLElement | null;
    const indexAttr = slideEl?.getAttribute("data-swiper-slide-index");
    if (indexAttr == null) return;
    const href = SLIDES[Number(indexAttr)]?.href;
    if (href) router.push(href);
  }

  return (
    <section className="px-6">
      <h3 className="mb-3 text-lg font-semibold text-ink">
        גלה עוד
      </h3>

      <Swiper
        modules={[Autoplay, Pagination]}
        slidesPerView={1}
        spaceBetween={0}
        loop
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
        onClick={handleClick}
        className="rounded-[30px] shadow-xl"
      >
        {SLIDES.map((slide) => (
          <SwiperSlide key={slide.href} className="cursor-pointer">
            <Image
              src={slide.image}
              alt={slide.alt}
              width={1200}
              height={675}
              priority
              className="block h-auto w-full"
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
