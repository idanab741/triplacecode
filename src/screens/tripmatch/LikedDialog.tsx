"use client";

import Image from "next/image";

interface LikedDialogProps {
  placeName: string;
  onContinue: () => void;
  onViewPlace: () => void;
}

/** Dialog אחרי Like - קמע Tripy + חגיגיות עדינה (בלי לחרוג מה-Design
 *  System: אותם צבעים/גופן/רדיוסים כמו שאר האפליקציה). */
export function LikedDialog({ placeName, onContinue, onViewPlace }: LikedDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm">
      <div className="relative w-full max-w-sm overflow-hidden rounded-card bg-white pb-6 text-center shadow-soft">
        {/* רצועת גרדיאנט עדינה - נותנת תחושת "רגע חגיגי" בלי לצאת מפלטת */}
        {/* הצבעים הקיימת. התמונה עצמה (קמע + טלפון) מגיעה עם רקע לבן משלה */}
        {/* ולכן מוצגת על "כרטיס" לבן קטן במרכז הרצועה, לא חתוכה לעיגול. */}
        <div
          className="relative flex h-36 items-center justify-center"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)", backgroundSize: "16px 16px" }} />
          <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg">
            <Image src="/images/tripmatch-liked-mascot.png" alt="" fill className="object-cover object-top" />
          </div>
        </div>

        <div className="px-6 pt-5">
          <p className="text-lg font-extrabold text-ink">{placeName} נוסף למועדפים!</p>
          <p className="mt-1.5 text-[13.5px] text-ink-secondary">האם תרצו להמשיך להחליק?</p>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onViewPlace}
              className="flex-1 rounded-pill bg-bg-secondary py-3 text-sm font-semibold text-ink transition active:scale-[0.97]"
            >
              לא, הצג לי
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="flex-1 rounded-pill py-3 text-sm font-semibold text-white shadow-soft transition active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              כן, המשך
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
