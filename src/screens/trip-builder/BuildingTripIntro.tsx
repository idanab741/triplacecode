"use client";

import Image from "next/image";

/**
 * מסך ביניים קצר שמוצג לפני שעוברים למסך המשחק (LoadingGame) בזמן
 * שבונים את הטיול - כותרת "בונים עבורך את הטיול המושלם!" ומתחתיה תיבה
 * עם לוגו runtrippy שדופק לאט (גדל/קטן), כדי לתת תחושת התקדמות רגועה
 * לפני שהמשחק בפועל עולה.
 */
export function BuildingTripIntro() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-bg px-6">
      <p className="max-w-xs text-center text-lg font-semibold text-ink">
        בונים עבורך את הטיול המושלם!
      </p>

      <div className="flex h-40 w-40 items-center justify-center rounded-card bg-white shadow-md">
        <div
          className="relative h-28 w-28"
          style={{ animation: "runtrippyPulse 2.6s ease-in-out infinite" }}
        >
          <Image src="/images/game/runtrippy-logo.png" alt="" fill className="object-contain" />
        </div>
      </div>

      <style jsx>{`
        @keyframes runtrippyPulse {
          0%,
          100% {
            transform: scale(0.88);
          }
          50% {
            transform: scale(1.08);
          }
        }
      `}</style>
    </div>
  );
}
