"use client";

import Image from "next/image";
import Link from "next/link";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";

const SLIDES = [
  {
    href: "/tripmatch",
    image: "/images/discover/tripmatch.png",
    alt: "TripMatch",
  },
  {
    href: "/ai",
    image: "/images/discover/ai-powered.png",
    alt: "AI Powered",
  },
  {
    href: "/places",
    image: "/images/discover/places.png",
    alt: "Places",
  },
];

export function DiscoverCard() {
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
        className="rounded-[30px] shadow-xl"
      >
        {SLIDES.map((slide) => (
          <SwiperSlide key={slide.href}>
            <Link href={slide.href}>
              <Image
                src={slide.image}
                alt={slide.alt}
                width={1200}
                height={675}
                priority
                className="block w-full h-auto"
              />
            </Link>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}