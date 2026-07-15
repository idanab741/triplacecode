"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

const AUTOPLAY_DELAY = 5000;

export function DiscoverCard() {
  const [current, setCurrent] = useState(0);
  const startX = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, AUTOPLAY_DELAY);

    return () => clearInterval(timer);
  }, []);

  const next = () => {
    setCurrent((prev) => (prev + 1) % SLIDES.length);
  };

  const prev = () => {
    setCurrent((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  return (
    <section className="px-6">
      <h3 className="mb-3 text-lg font-semibold text-ink">
        גלה עוד
      </h3>

      <div
        className="overflow-hidden rounded-3xl shadow-xl"
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const diff = startX.current - e.changedTouches[0].clientX;

          if (diff > 50) next();
          if (diff < -50) prev();
        }}
      >
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{
            width: `${SLIDES.length * 100}%`,
            transform: `translateX(-${current * (100 / SLIDES.length)}%)`,
          }}
        >
          {SLIDES.map((slide, index) => (
            <div
              key={index}
              style={{
                width: `${100 / SLIDES.length}%`,
              }}
              className="flex-shrink-0"
            >
              <Link href={slide.href} className="block">
                <Image
                  src={slide.image}
                  alt={slide.alt}
                  width={1200}
                  height={675}
                  priority={index === 0}
                  draggable={false}
                  className="block w-full h-auto"
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
            onClick={() => setCurrent(index)}
            className={`h-2 rounded-full transition-all ${
              current === index
                ? "w-6 bg-blue-500"
                : "w-2 bg-blue-300"
            }`}
          />
        ))}
      </div>
    </section>
  );
