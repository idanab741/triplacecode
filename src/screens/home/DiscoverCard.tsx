"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

interface DiscoverSlide {
  href: string;
  title: string;
  subtitle: string;
}

/**
 * תוכן הכרטיסים בקרוסלה. אפשר להוסיף/לשנות כרטיסים כאן בקלות —
 * כל אובייקט הוא כרטיס אחד (עיצוב זהה לכולם, כמו בכרטיס המקורי).
 */
const SLIDES: DiscoverSlide[] = [
  {
    href: "/ai",
    title: "מתכננים חופשה מושלמת יחד",
    subtitle: "בקרוב: תכננו טיול ביחד עם חברים ובני משפחה",
  },
  {
    href: "/ai",
    title: "טריפלייס בונה לכם מסלול חכם",
    subtitle: "AI שמכיר את הטעם שלכם ומתאים לכם יעדים אמיתיים",
  },
  {
    href: "/ai",
    title: "גלו מקומות שלא הכרתם",
    subtitle: "המלצות מותאמות אישית לפי מה שאתם אוהבים",
  },
];

const AUTOPLAY_DELAY = 5500; // ms

/** קרוסלת כרטיסי "גלה עוד" — כרטיס אחד ברוחב מלא בכל רגע, מתחלף אוטומטית
 *  (Embla Autoplay, לא מומצא בעצמנו), עם אפשרות להחליק ידנית. אחרי החלקה
 *  ידנית ה-autoplay ממשיך כרגיל (לא נעצר לצמיתות). */
export function DiscoverCard() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: AUTOPLAY_DELAY, stopOnInteraction: false, stopOnMouseEnter: true }),
  ]);
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
      <h3 className="mb-3 text-lg font-semibold text-ink">גלה עוד</h3>

      <div className="overflow-hidden rounded-card" ref={emblaRef}>
        <div className="flex">
          {SLIDES.map((slide, i) => (
            <div key={i} className="min-w-0 shrink-0 grow-0 basis-full">
              <Link
                href={slide.href}
                className="block rounded-card bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] p-6 shadow-soft"
              >
                <p className="text-lg font-bold text-white">{slide.title}</p>
                <p className="mt-1 text-sm text-white/80">{slide.subtitle}</p>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {SLIDES.length > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === selectedIndex ? 16 : 6,
                backgroundColor: "var(--color-primary-start)",
                opacity: i === selectedIndex ? 1 : 0.3,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}