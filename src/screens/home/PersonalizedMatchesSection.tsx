"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";

/**
 * "🎯 התאמנו לכם" (Audit - "צריך שיהיו פה אטרקציות! לא יעדים!! למשל -
 * SUMMIT תצפית בניו יורק, קפה פופולרי בת"א, נמל תל אביב, יער בן שמן").
 *
 * תיקון מהותי: הגרסה הקודמת השתמשה ב-usePersonalizedDestinations
 * (טבלת destinations - ערים/מדינות) - זה בדיוק מה שהבקשה אומרת שזה
 * *לא* אמור להיות. עכשיו מציג אטרקציות/מקומות אמיתיים (places table,
 * דרך אותו day-trip/restaurants-cafes "hot" שכבר מושך Nearby - geo-
 * based אמיתי, לא מומצא) ומוביל ל-/place/[id] האמיתי (עמוד האטרקציה,
 * לא עמוד יעד).
 *
 * *** TODO(backend): "בהתאם ללמידת המשתמש וההעדפות האישיות" - אין
 * עדיין endpoint שמדרג places ספציפיים (לא destinations) לפי Travel
 * DNA של המשתמש מחוץ ל-session פעיל של TripMatch (שם יש ניקוד אמיתי -
 * ר' computeMatchPercent ב-app/tripmatch/page.tsx, אבל הוא פועל רק על
 * מועמדים שכבר נטענו לקטגוריה/עיר ספציפית שנבחרה, לא כ"top picks"
 * גלובלי לעמוד הבית). לכן אין badge עם אחוז מזויף כאן - רק "✨ מומלץ
 * לכם" בלי מספר, עד שתתווסף לוגיקת דירוג אמיתית ברמת מקום בודד.
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
        // *** תיקון (Audit - "אסור שיהיה אותה פעילות פעמיים!" - "הפארק
        // הלאומי רמת גן" הופיע פעמיים): dedup לפי id בלבד לא הספיק - זה
        // אומר ששני מקומות עם אותו שם קיימים כשתי רשומות שונות ב-DB
        // (id שונה לכל אחד, כנראה כפילות אמיתית בנתונים, לא בשאילתה).
        // מוסיפים גם dedup לפי שם מנורמל (trim+lowercase) כרשת ביטחון -
        // לא פותר את הכפילות במקור (זה תיקון בטבלת places באדמין), אבל
        // מונע הצגה כפולה למשתמש בינתיים.
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
            className="flex flex-col overflow-hidden rounded-card bg-white text-right shadow-soft transition active:scale-[0.98]"
          >
            <div className="relative h-28 w-full bg-bg-secondary">
              {a.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
              )}
              <span
                className="absolute right-2 top-2 rounded-pill px-2.5 py-1 text-[11px] font-bold text-white shadow-lg"
                style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
              >
                ✨ מומלץ לכם
              </span>
            </div>
            <div className="flex flex-col gap-0.5 px-3 py-2.5">
              <span className="line-clamp-1 text-[13.5px] font-semibold text-ink">{a.name}</span>
              {a.city && <span className="line-clamp-1 text-[12px] text-ink-secondary">{a.city}</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
