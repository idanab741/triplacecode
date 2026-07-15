"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

interface DiscoverSlide {
  href: string;
  image: string;
  alt: string;
}

const SLIDES: DiscoverSlide[] = [
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
  {
    href: "/group-trip",
    image: "/images/discover/group-trip.png",
    alt: "Group Trip",
  },
];

const AUTOPLAY_DELAY = 5500;

export function DiscoverCard() {
  const autoplay = Autoplay({
    delay: AUTOPLAY_DELAY,
    stopOnInteraction: false,
    stopOnMouseEnter: true,
  });

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "start",
      dragFree: false,
    },
    [autoplay]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    onSelect();

    emblaApi.on("select", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="px-6">
      <h3 className="mb-3 text-lg font-semibold text-ink">
        גלה עוד
      </h3>

      <div
        className="overflow-hidden rounded-3xl shadow-lg"
        ref={emblaRef}
      >
        <div className="flex">
          {SLIDES.map((slide, index) => (
            <div
              key={index}
              className="min-w-0 flex-[0_0_100%]"
            >
              <Link href={slide.href}>
                <Image
                  src={slide.image}
                  alt={slide.alt}
                  width={1200}
                  height={675}
                  className="block w-full h-auto"
                  priority={index === 0}
                />
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-2">
        {SLIDES.map((_, index) => (
          <span
            key={index}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === selectedIndex
                ? "w-6 bg-blue-500"
                : "w-2 bg-blue-500/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}