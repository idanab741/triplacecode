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

const AUTO_PLAY = 5000;

export function DiscoverCard() {
  const [current, setCurrent] = useState(0);

  const touchStart = useRef(0);
  const touchEnd = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, AUTO_PLAY);

    return () => clearInterval(interval);
  }, []);

  const next = () => {
    setCurrent((prev) => (prev + 1) % SLIDES.length);
  };

  const prev = () => {
    setCurrent((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const distance = touchStart.current - touchEnd.current;

    if (distance > 50) {
      next();
    }

    if (distance < -50) {
      prev();
    }
  };

  return (
    <section className="px-6">
      <h3 className="mb-3 text-lg font-semibold text-ink">
        גלה עוד
      </h3>

      <div
        className="relative overflow-hidden rounded-3xl shadow-xl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{
            transform: `translateX(-${current * 100}%)`,
          }}
        >
          {SLIDES.map((slide, index) => (
            <Link
              key={index}
              href={slide.href}
              className="w-full shrink-0"
            >
              <Image
                src={slide.image}
                alt={slide.alt}
                width={1200}
                height={675}
                priority={index === 0}
                draggable={false}
                className="block w-full rounded-3xl select-none"
              />
            </Link>
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
                ? "w-7 bg-blue-500"
                : "w-2 bg-blue-300"
            }`}
          />
        ))}
      </div>
    </section>
  );
}