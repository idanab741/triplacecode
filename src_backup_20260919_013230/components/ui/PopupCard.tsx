"use client";

import Image from "next/image";
import type { MouseEvent, ReactNode } from "react";

interface PopupCardProps {
  onClose: () => void;
  /** תמונת הקמע (Trippy) - כל Popup מקבל וריאציה משלו (עצוב/לבבות/רגיל וכו'),
   *  אבל תמיד באותה מסגרת עגולה, אותו גודל, אותו מיקום. */
  imageSrc: string;
  imageAlt: string;
  children: ReactNode;
}

/** אייקון X לסגירה - אותו סגנון בדיוק כמו ב-InviteFriendsCard/LikedDialog. */
function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * מארז משותף (Design System) לכל ה-Popups הממותגים של Trippy - פופאפ
 * "נגמרו הטריפים" (TokenBalancePill.tsx) ופופאפ "שינוי מיקום"
 * (LocationPromptModal.tsx) בנויים על גביו.
 *
 * *** נוצר (בקשה מפורשת - "שני החלונות צריכים להרגיש כאילו הם חלק
 * מאותה מערכת עיצוב... אבל לכל Popup תהיה אישיות שונה באמצעות תמונת
 * Trippy המתאימה"): כל מה שמשותף (מבנה כרטיס, border radius, צל, X,
 * באנר גרדיאנט, גודל/מיקום עיגול הקמע, אנימציית כניסה) חי כאן פעם
 * אחת - כל Popup מזין רק את תמונת הקמע שלו ואת התוכן הספציפי
 * (כותרת/טקסט/כרטיסים/כפתורים), בלי שכפול קוד בין השניים.
 */
export function PopupCard({ onClose, imageSrc, imageAlt, children }: PopupCardProps) {
  return (
    <div className="popup-card relative overflow-hidden rounded-card bg-white pb-6 text-center shadow-soft">
      <button
        type="button"
        onClick={onClose}
        aria-label="סגירה"
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft backdrop-blur-sm"
      >
        <CloseIcon />
      </button>

      {/* באנר גרדיאנט עדין - הרקע הוויזואלי מאחורי הקמע */}
      <div
        className="relative h-24 w-full overflow-hidden"
        style={{ background: "linear-gradient(135deg, #eaf3ff 0%, #f4eeff 55%, #fff5ef 100%)" }}
      >
        <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 300 96" fill="none">
          <path d="M-10 70 Q 70 20 150 55 T 320 30" stroke="var(--color-primary-start)" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round" />
        </svg>
        <span className="absolute left-4 top-3 h-10 w-10 rounded-full bg-white/50 blur-md" />
        <span className="absolute bottom-2 right-8 h-6 w-6 rounded-full bg-[var(--color-category-purple)]/20 blur-sm" />
      </div>

      {/* עיגול הקמע - חופף את הבאנר מלמטה, אותו דפוס בדיוק כמו LikedDialog/InviteFriendsCard */}
      <div className="popup-card-avatar relative -mt-12 flex justify-center">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-lg">
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={240}
            height={240}
            quality={90}
            className="h-full w-full object-cover"
            priority
          />
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-4 px-6 text-center">{children}</div>

      <style jsx>{`
        .popup-card {
          animation: popup-card-fade-scale 0.32s cubic-bezier(0.22, 1, 0.36, 1) backwards;
        }
        .popup-card-avatar {
          animation: popup-card-avatar-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) 0.08s backwards;
        }
        @keyframes popup-card-fade-scale {
          from {
            opacity: 0;
            transform: scale(0.94);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes popup-card-avatar-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .popup-card,
          .popup-card-avatar {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * מארז ה-Overlay המשותף (backdrop כהה + blur, ממורכז, שוליים במובייל) -
 * אותו דפוס בדיוק כמו InviteFriendsModal/LikedDialog. משמש כעטיפה
 * סביב PopupCard בכל מקום שבו נפתח Popup ממותג.
 */
export function PopupOverlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
