"use client";

import { useRef, useState } from "react";
import { optimizeImage } from "@/utils/imageUrl";

/** תמונת האטרקציה. כשיש כמה תמונות (משתמשים שהעלו) - מחליקים ביניהן, עם מונה קטן. */
export function AttractionHero({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    setIndex(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  }

  if (images.length === 0) {
    return <div className="aspect-[4/3] w-full bg-[#EFF1F4]" aria-hidden="true" />;
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto bg-[#EFF1F4]"
        style={{ scrollbarWidth: "none" }}
      >
        {images.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={optimizeImage(url, 430)} alt={i === 0 ? name : ""} loading={i === 0 ? "eager" : "lazy"} decoding="async" draggable={false} className="h-full w-full shrink-0 snap-center object-cover" />
        ))}
      </div>
      {/* דעיכה לבנה עדינה בראש התמונה - כדי שהלוגו השחור והאייקונים יישארו קריאים גם על תמונה
          כהה או עמוסה, בלי להחזיר פס לבן אטום. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.45) 45%, rgba(255,255,255,0) 100%)" }}
      />
      {images.length > 1 && (
        <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-semibold text-white tabular-nums backdrop-blur-sm">
          {index + 1}/{images.length}
        </span>
      )}
    </div>
  );
}
