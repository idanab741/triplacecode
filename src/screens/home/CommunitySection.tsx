"use client";

import { useEffect, useState } from "react";

/**
 * "👥 ה-Matches של הקהילה" (Audit - "מאיפה הנתונים?" - בצדק). עכשיו
 * מושך נתונים אמיתיים מ-/api/places/community-highlights (ספירת
 * favorites אמיתית מטבלת favorites הקיימת) - לא mock. תמונות מגיעות
 * מ-place.image_urls האמיתי (אותו מקור שכל שאר האפליקציה כבר מציגה),
 * לא מתמונות סטטיות שאולי לא קיימות ב-public.
 */
interface CommunityHighlight {
  id: string;
  name: string;
  city: string | null;
  imageUrl: string | null;
  favoriteCount: number;
}

export function CommunitySection() {
  const [highlights, setHighlights] = useState<CommunityHighlight[] | null>(null);

  useEffect(() => {
    fetch("/api/places/community-highlights?limit=6")
      .then((res) => res.json())
      .then((data) => setHighlights(data.highlights ?? []))
      .catch(() => setHighlights([]));
  }, []);

  // אין עדיין נתוני קהילה אמיתיים (אף מקום לא נשמר/סומן לייק) - לא
  // מציגים בכלל את הסקשן, במקום להמציא סטטיסטיקות.
  if (highlights !== null && highlights.length === 0) return null;

  return (
    <section className="px-6">
      <h3 className="text-lg font-semibold tracking-tight text-ink">👥 ה-Matches של הקהילה</h3>
      <p className="mt-0.5 text-sm text-ink-secondary">מקומות שאנשים בוחרים עכשיו</p>

      {/* תיקון (שוליים נחתכים בסוף הגלילה) - ראו הסבר מפורט ב-TrendingSection
          (אותו באג, אותה קטגוריית קונטיינר overflow-x-auto): padding בסוף
          קונטיינר גלילה לא תמיד נשמר עד סוף ה-scrollWidth, בולט ב-RTL.
          ps-6 שומר על השוליים בתחילת הגלילה (עבדו תקין), וספייסר אמיתי
          (w-3, שיחד עם ה-gap-3 הטבעי משלים ל-24px) מחליף את ה-padding
          שנחתך בסוף. */}
      <div className="mt-3 -mx-6 flex gap-3 overflow-x-auto ps-6 pb-1" style={{ scrollbarWidth: "none" }}>
        {highlights === null
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 w-56 shrink-0 animate-pulse rounded-card bg-bg-secondary" />
            ))
          : highlights.map((h) => (
              <div key={h.id} className="relative h-40 w-56 shrink-0 overflow-hidden rounded-card shadow-soft">
                {h.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.imageUrl} alt={h.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-bg-secondary" />
                )}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(0deg,rgba(0,0,0,0.75),transparent)]" />
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 px-3 pb-3 text-white">
                  <span className="line-clamp-1 text-[13.5px] font-semibold">{h.name}</span>
                  <span className="text-[12px] text-white/90">
                    ❤️ {h.favoriteCount.toLocaleString()} {h.favoriteCount === 1 ? "שמר" : "שמרו"} את המקום הזה
                    {h.city ? ` · ${h.city}` : ""}
                  </span>
                </div>
              </div>
            ))}
        {highlights !== null && highlights.length > 0 && <div aria-hidden className="w-3 shrink-0" />}
      </div>
    </section>
  );
}
