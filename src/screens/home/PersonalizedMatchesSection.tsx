"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";

/**
 * "🎯 התאמנו לכם" (Audit - "למה זה לא בנוי כמו האטרקציות שלנו? תמונה
 * מלאה עם צל למטה, הטקסט בתוך התמונה"): עכשיו מאמץ את אותה שפה
 * ויזואלית בדיוק כמו DiscoveryPlaceCard.tsx (הכרטיס האחיד שכבר בשימוש
 * בכל שאר ה-Discovery באפליקציה) - תמונה מלאה (object-cover), badge
 * "מומלץ לכם" בפינה במקום דירוג-כוכבים, גרדיאנט כהה בתחתית עם הטקסט
 * *בתוך* התמונה - לא בלוק טקסט לבן נפרד מתחת לתמונה כמו קודם.
 */
interface AttractionCard {
  id: string;
  name: string;
  city: string | null;
  imageUrl: string | null;
}

export function PersonalizedMatchesSection() {
  const [attractions, setAttractions] = useState<AttractionCard[] | null>(null);

  useEffect(() => {
    getCurrentPositionSafe()
      .then((coords) =>
        Promise.all([
          fetch(`/api/discovery/day-trip?category=hot&lat=${coords.lat}&lng=${coords.lng}&limit=6`).then((r) => r.json()),
          fetch(`/api/discovery/restaurants-cafes?category=hot&lat=${coords.lat}&lng=${coords.lng}&limit=4`).then((r) =>
            r.json()
          ),
        ])
      )
      .then(([dayTrip, food]) => {
        interface RawPlace { id: string; name: string; city: string | null; imageUrls: string[] }
        const rawPlaces: RawPlace[] = [...(dayTrip.places ?? []), ...(food.places ?? [])];
        const seenIds = new Set<string>();
        const seenNames = new Set<string>();
        const cards: AttractionCard[] = [];
        for (const p of rawPlaces) {
          const normalizedName = p.name.trim().toLowerCase();
          if (seenIds.has(p.id) || seenNames.has(normalizedName)) continue;
          seenIds.add(p.id);
          seenNames.add(normalizedName);
          cards.push({ id: p.id, name: p.name, city: p.city, imageUrl: p.imageUrls?.[0] ?? null });
          if (cards.length >= 4) break;
        }
        setAttractions(cards);
      })
      .catch(() => setAttractions([]));
  }, []);

  if (!attractions || attractions.length === 0) return null;

  return (
    <section className="px-6">
      <h3 className="text-lg font-semibold tracking-tight text-ink">🎯 התאמנו לכם</h3>
      <p className="mt-0.5 text-sm text-ink-secondary">אטרקציות ומקומות שכדאי להכיר</p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {attractions.map((a) => (
          <Link
            key={a.id}
            href={`/place/${a.id}`}
            className="relative block h-[180px] overflow-hidden rounded-card bg-bg-secondary shadow-soft"
          >
            {a.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="h-full w-full bg-bg-secondary" />
            )}

            <span className="absolute start-2 top-2 whitespace-nowrap rounded-pill bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] px-2 py-0.5 text-[10px] font-bold text-white shadow-soft">
              ✨ מומלץ לכם
            </span>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.75)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2.5 pt-10">
              <p className="truncate text-sm font-bold leading-tight text-white">{a.name}</p>
              {a.city && <p className="truncate text-[11px] text-white/85">{a.city}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
