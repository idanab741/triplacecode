"use client";

import { useRef, useState } from "react";

interface ImageCarouselProps {
  images: string[];
  alt: string;
}

/** גלילה אופקית בין תמונות היעד, עם נקודות חיווי. */
export function ImageCarousel({ images, alt }: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    setActiveIndex(index);
  }

  if (images.length === 0) {
    return <div className="h-full w-full bg-bg-secondary" />;
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {images.map((src, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={index}
            src={src}
            alt={alt}
            className="h-full w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>

      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
          {images.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-pill transition-all ${
                index === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
