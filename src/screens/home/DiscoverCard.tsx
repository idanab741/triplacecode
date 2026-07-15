"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

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
  const autoplay = useRef(
    Autoplay({
      delay: 5000,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    })
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "center",
      dragFree: false,
      skipSnaps: false,
    },
    [autoplay.current]
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
    emblaApi.on("reInit", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <section className="px-6">
      <h3 className="mb-3 text-lg font-semibold text-ink">
        גלה עוד
      </h3>

      <div
        ref={emblaRef}
        className="overflow-hidden rounded-3xl shadow-xl"
      >
        <div className="flex">
          {SLIDES.map((slide, index) => (
            <div
              key={slide.href}
              className="flex-[0_0_100%]"
            >
              <Link href={slide.href}>
                <Image
                  src={slide.image}
                  alt={slide.alt}
                  width={1200}
                  height={675}
                  priority={index === 0}
                  draggable={false}
                  className="block w-full h-auto select-none"
                />
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {SLIDES.map((_, index) => (
          <button
            key={index}
            onClick={() => emblaApi?.scrollTo(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              selectedIndex === index
                ? "w-7 bg-blue-500"
                : "w-2 bg-blue-300"
            }`}
          />
        ))}
      </div>
    </section>
  );
}