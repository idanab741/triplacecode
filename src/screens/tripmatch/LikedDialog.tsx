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
        {/* רצועת גרדיאנט עדינה מאחורי הקמע - נותנת תחושת "רגע חגיגי" בלי */}
        {/* לצאת מפלטת הצבעים הקיימת */}
        <div
          className="relative flex h-28 items-end justify-center pb-2"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)", backgroundSize: "16px 16px" }} />
          <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-lg">
            <Image src="/images/tripy.png" alt="" fill className="object-cover" />
          </div>
          <span className="absolute -end-1 top-3 text-2xl">❤️</span>
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
