"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WORLDWIDE_DESTINATION_REGISTRY } from "@/constants/worldwideVacationCategories";
import { getFeaturedDestinations } from "@/services/destinations/destinationsService";

/**
 * "🔥 כולם מחפשים עכשיו" (Audit - "זה סתם כרטיסיות של יעדים בעולם, לא
 * מה שהיה קודם! צריך את הרשימה עם כריסמס בניו יורק, ברצלונה בכדורגל
 * וכו', גם ישראל וגם עולם"). מקור הדאטה עכשיו:
 * 1. WORLDWIDE_DESTINATION_REGISTRY + ה-subtitle/imageUrl הקשריים
 *    (worldwideVacationCategories.ts) - אותה רשימה מוקפדת עם ההקשרים
 *    ("בכריסמס", "משחקי ברצלונה") שכבר קיימת ומוצגת ב"חופשה בחו״ל" -
 *    לא רשימת ערים סתמית.
 * 2. getFeaturedDestinations() מסונן ל-country="ישראל" - יעדים חמים
 *    אמיתיים בארץ, מאותו מקור בדיוק כמו "התאמנו לכם".
 * ה-UUID האמיתי לכל יעד חו"ל מגיע מ-/api/discovery/worldwide-categories
 * (אותה שיטת mapping בדיוק כמו WorldwideCategorySection.tsx הקיים) -
 * לא נבנה מנגנון resolve חדש.
 */
interface TrendingCard {
  key: string;
  name: string;
  flag?: string;
  subtitle?: string;
  imageUrl: string;
  destinationId: string | null;
}

// בחירה מוקפדת מתוך worldwideVacationCategories.ts הקיים - ההקשרים
// הספציפיים (לא רק שם עיר) הם בדיוק מה שנתבקש.
const CURATED_WORLDWIDE: { slug: string; subtitle?: string; imageUrl?: string }[] = [
  { slug: "new-york", subtitle: "בכריסמס", imageUrl: "/images/destination/newyork-christmas.png" },
  { slug: "barcelona", subtitle: "משחקי ברצלונה", imageUrl: "/images/destination/barcelona-sports.png" },
  { slug: "santorini" },
  { slug: "paris", subtitle: "בכריסמס", imageUrl: "/images/destination/paris-christmas.png" },
  { slug: "mykonos" },
];

export function TrendingSection() {
  const [cards, setCards] = useState<TrendingCard[] | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/discovery/worldwide-categories").then((res) => res.json()),
      getFeaturedDestinations(30),
    ]).then(([worldwideData, featured]) => {
      const idBySlug: Record<string, string | null> = worldwideData.matches ?? {};

      const worldwideCards = CURATED_WORLDWIDE.map((ref): TrendingCard | null => {
        const entry = WORLDWIDE_DESTINATION_REGISTRY[ref.slug];
        if (!entry) return null;
        return {
          key: `w-${ref.slug}`,
          name: entry.name,
          flag: entry.flag,
          subtitle: ref.subtitle,
          imageUrl: ref.imageUrl ?? entry.imageUrl,
          destinationId: idBySlug[ref.slug] ?? null,
        };
      }).filter((c): c is TrendingCard => c !== null);

      const israeliCards: TrendingCard[] = featured
        .filter((d) => d.country === "ישראל" && d.image_url)
        .slice(0, 4)
        .map((d) => ({ key: `i-${d.id}`, name: d.name, imageUrl: d.image_url as string, destinationId: d.id }));

      // מערבבים ישראל/עולם לסירוגין - "הכי מחופש עכשיו" צריך להרגיש
      // מעורב, לא "כל הארץ ואז כל העולם".
      const mixed: TrendingCard[] = [];
      const maxLen = Math.max(worldwideCards.length, israeliCards.length);
      for (let i = 0; i < maxLen; i++) {
        if (israeliCards[i]) mixed.push(israeliCards[i]);
        if (worldwideCards[i]) mixed.push(worldwideCards[i]);
      }
      setCards(mixed);
    });
  }, []);

  if (!cards || cards.length === 0) return null;

  return (
    <section className="px-6">
      <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink">🔥 כולם מחפשים עכשיו</h3>
      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: "none" }}>
        {cards.map((c) => {
          const content = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.imageUrl} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.75)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2.5 pt-10">
                <p className="truncate text-sm font-bold leading-tight text-white">
                  {c.flag ? `${c.flag} ` : ""}
                  {c.name}
                </p>
                {c.subtitle && <p className="truncate text-[11px] text-white/85">{c.subtitle}</p>}
              </div>
            </>
          );
          const className =
            "relative block h-[220px] w-[150px] shrink-0 overflow-hidden rounded-card bg-bg-secondary shadow-soft";
          return c.destinationId ? (
            <Link key={c.key} href={`/destination/${c.destinationId}`} className={className}>
              {content}
            </Link>
          ) : (
            <div key={c.key} className={className}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
