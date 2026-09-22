"use client";

import Image from "next/image";

/**
 * בועת צ'אט לחיצה שמופיעה אחרי הודעת "בונים עבורך את המסלול המושלם" -
 * לוגו runtrippy שדופק לאט (גדל/קטן) בתוך בועת צ'אט רגילה. בשונה מהמסך
 * המלא הקודם, המעבר למשחק (LoadingGame) לא קורה אוטומטית - רק לחיצה על
 * הבועה הזו (onClick) מפעילה בפועל את בניית הטיול ומעבירה למסך המשחק.
 */
export function RuntrippyPromptBubble({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-start">
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-3 rounded-card bg-white px-4 py-3 shadow-md transition active:scale-95"
      >
        <div
          className="relative h-12 w-16 shrink-0"
          style={{ animation: "runtrippyChatPulse 2.6s ease-in-out infinite" }}
        >
          <Image src="/images/game/runtrippy-logo.png" alt="run trippy" fill sizes="64px" className="object-contain" />
        </div>
        <span className="text-sm font-semibold text-ink">בואו נצא לדרך!</span>
      </button>

      <style jsx>{`
        @keyframes runtrippyChatPulse {
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
