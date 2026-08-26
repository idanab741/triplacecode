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
 *
 * תיקון Product מפורש ("צריך להתחלף כל 24 שעות! האם זה קורה?"): לא -
 * הגרסה הקודמת פשוט מיינה לפי דירוג ולקחה את ה-4 הראשונים, דטרמיניסטי
 * לחלוטין - אותם 4 מקומות תמיד, בלי תלות בתאריך. עכשיו שולפים בריכה
 * גדולה יותר (20+20, לא 6+4), ובוחרים מתוכה 4 בעזרת ערבוב-מדורג
 * ("seeded shuffle") שהזרע שלו הוא **תאריך היום** - אותו יום = אותה
 * בחירה בדיוק (יציב, לא מקפיץ בכל רענון עמוד), יום אחר = ערבוב שונה
 * לגמרי. אין צורך ב-DB/cron בשביל זה - זה חישוב טהור בצד הלקוח, בלי
 * state צד-שרת.
 */
interface AttractionCard {
  id: string;
  name: string;
  city: string | null;
  imageUrl: string | null;
}

/** PRNG פשוט וקטני (mulberry32) שמקבל seed מספרי - דטרמיניסטי לגמרי:
 *  אותו seed מייצר תמיד את אותה סדרת "אקראיות". */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** hash מחרוזת->מספר (למשל "2026-08-27") - כדי להזין ל-PRNG למעלה. */
function hashStringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/** Fisher-Yates עם PRNG מדורג - סדר שונה כל יום, יציב באותו יום. */
function seededShuffle<T>(items: T[], seedStr: string): T[] {
  const rand = mulberry32(hashStringToSeed(seedStr));
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** תאריך היום כמחרוזת יציבה (UTC) - זרע ה-shuffle. משתנה פעם ביום
 *  בדיוק - "כל 24 שעות" כמבוקש. */
function todaySeed(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PersonalizedMatchesSection() {
  const [attractions, setAttractions] = useState<AttractionCard[] | null>(null);

  useEffect(() => {
    getCurrentPositionSafe()
      .then((coords) =>
        Promise.all([
          fetch(`/api/discovery/day-trip?category=hot&lat=${coords.lat}&lng=${coords.lng}&limit=20`).then((r) => r.json()),
          fetch(`/api/discovery/restaurants-cafes?category=hot&lat=${coords.lat}&lng=${coords.lng}&limit=20`).then((r) =>
            r.json()
          ),
        ])
      )
      .then(([dayTrip, food]) => {
        interface RawPlace { id: string; name: string; city: string | null; imageUrls: string[] }
        const rawPlaces: RawPlace[] = [...(dayTrip.places ?? []), ...(food.places ?? [])];
        const seenIds = new Set<string>();
        const seenNames = new Set<string>();
        const pool: AttractionCard[] = [];
        for (const p of rawPlaces) {
          const normalizedName = p.name.trim().toLowerCase();
          if (seenIds.has(p.id) || seenNames.has(normalizedName)) continue;
          seenIds.add(p.id);
          seenNames.add(normalizedName);
          pool.push({ id: p.id, name: p.name, city: p.city, imageUrl: p.imageUrls?.[0] ?? null });
        }
        const cards = seededShuffle(pool, todaySeed()).slice(0, 4);
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
