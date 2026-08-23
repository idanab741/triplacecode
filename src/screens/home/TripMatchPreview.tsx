"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { SwipeCard } from "@/components/ui";
import { TRIPMATCH_CATEGORY_BUCKETS, type TripMatchCategoryBucket } from "@/locales/he/tripBuilder";

/**
 * TripMatch Preview - בלוק אינטראקטיבי בעמוד הבית, ממוקם מעל "גלה עוד"
 * (ר' HomePage). נותן טעימה אמיתית מחוויית ה-Swipe של TripMatch בלי
 * לשכפל את העמוד המלא: משתמש ב-SwipeCard הקיים (אותה פיזיקת גרירה/
 * fly-out ותגיות ❤️/✕ בדיוק כמו TripMatch עצמו - ר' components/ui/
 * SwipeCard.tsx), ובאותם 4 "דליים" קטגוריאליים ותמונותיהם שכבר קיימים
 * ב-TRIPMATCH_CATEGORY_BUCKETS (locales/he/tripBuilder.ts) - כדי להמחיש
 * "TripMatch מתאים את עצמו למה שאני אוהב" בלי לקבע יעד ספציפי אחד ובלי
 * להמציא assets/מקומות מזויפים.
 *
 * לא בונה מנגנון swipe חדש: רק עוטף SwipeCard (מצב render-prop הקיים,
 * בדיוק כמו TripMatchCard בעמוד המלא) ומוסיף שתי שכבות "הצצה" סטטיות
 * מאחוריו כדי ליצור תחושת stack. Swipe (בכל כיוון) פשוט מסובב את
 * התור למועמד הבא - זו טעימה בלבד, לא שומר לייקים אמיתיים (זה קורה
 * בעמוד TripMatch המלא עצמו).
 */

const CARD_WIDTH = 168;
const CARD_HEIGHT = 220;

interface MiniCardProps {
  bucket: TripMatchCategoryBucket;
  interactive?: boolean;
  style?: CSSProperties;
}

function MiniCard({ bucket, interactive = false, style }: MiniCardProps) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-card bg-bg-secondary shadow-soft"
      style={style}
      aria-hidden={!interactive}
    >
      <Image
        src={bucket.imageSrc}
        alt={interactive ? bucket.label : ""}
        fill
        sizes="180px"
        className="object-cover"
        draggable={false}
      />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(0deg,rgba(0,0,0,0.72),transparent)]" />
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-3 pb-3 text-white">
        <span className="text-base leading-none">{bucket.emoji}</span>
        <span className="text-[13px] font-semibold leading-tight">{bucket.label}</span>
      </div>
    </div>
  );
}

export function TripMatchPreview() {
  const router = useRouter();
  // תור מחזורי של אינדקסים לתוך TRIPMATCH_CATEGORY_BUCKETS - תמיד מציגים
  // את שלושת הראשונים בתור (front/mid/back), ו-swipe פשוט מזיז את הראשון
  // לסוף התור (לולאה אינסופית, בלי "נגמרו הכרטיסים" בתוך ה-preview).
  const [queue, setQueue] = useState<number[]>(() => TRIPMATCH_CATEGORY_BUCKETS.map((_, i) => i));

  function advance() {
    setQueue((prev) => [...prev.slice(1), prev[0]]);
  }

  const [frontIdx, midIdx, backIdx] = queue;
  const frontBucket = TRIPMATCH_CATEGORY_BUCKETS[frontIdx];
  const midBucket = TRIPMATCH_CATEGORY_BUCKETS[midIdx];
  const backBucket = TRIPMATCH_CATEGORY_BUCKETS[backIdx];

  return (
    <section className="px-6">
      <div className="overflow-hidden rounded-card bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-5 md:flex-row-reverse md:items-center md:gap-7">
          {/* צד שמאל (visual) - stack הכרטיסים */}
          <div className="flex flex-col items-center gap-2 self-center md:items-start md:self-auto">
            <div className="relative" style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
              {backBucket && (
                <MiniCard
                  bucket={backBucket}
                  style={{ transform: "translate(-10px, -12px) scale(0.92)", opacity: 0.55, zIndex: 0 }}
                />
              )}
              {midBucket && (
                <MiniCard
                  bucket={midBucket}
                  style={{ transform: "translate(-5px, -6px) scale(0.96)", opacity: 0.8, zIndex: 10 }}
                />
              )}
              <div className="absolute inset-0" style={{ zIndex: 20 }}>
                <SwipeCard key={frontIdx} onSwipeLeft={advance} onSwipeRight={advance}>
                  <MiniCard bucket={frontBucket} interactive />
                </SwipeCard>
              </div>
            </div>
            <p className="flex items-center gap-1 text-[12px] font-medium text-ink-secondary">
              <span aria-hidden="true">←</span>
              <span>החליקו ימינה או שמאלה</span>
              <span aria-hidden="true">→</span>
            </p>
          </div>

          {/* צד ימין (visual) - תוכן וטקסט */}
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <Image src="/images/trip-tripmatch-logo.png" alt="TripMatch" width={96} height={30} className="object-contain" />
              <span className="text-base" aria-hidden="true">
                ✨
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-ink">מה בא לכם?</h3>
              <p className="text-sm leading-relaxed text-ink-secondary">
                החליקו בין חוויות ורעיונות ונמצא לכם את מה שמתאים לכם.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/tripmatch")}
              className="mt-1 self-start rounded-pill px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition active:scale-95"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              התחילו להחליק
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
