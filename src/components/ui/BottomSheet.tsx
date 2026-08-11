"use client";

import type { ReactNode, MouseEvent } from "react";

interface BottomSheetProps {
  onClose: () => void;
  children: ReactNode;
  /** z-index - ברירת מחדל 60. שיטס שנפתח מעל שיט אחר (כמו "כל הערים"
   *  מעל "בחרו מיקום") צריך z-index גבוה יותר כדי להופיע מעליו. */
  zIndex?: number;
}

/**
 * *** תיקון: לפני הרכיב הזה, לכל Bottom Sheet באפליקציה היה max-height
 * שונה שנקבע בנפרד (85vh, 80vh, 92dvh...) - זו הסיבה שכל פופ-אפ "קפץ"
 * בגובה שונה. עכשיו יש גובה קבוע אחד (90dvh - לא vh, כדי שלא ייחתך מאחורי
 * מקלדת המובייל) שבו כל השיטס באפליקציה אמורים להשתמש, כדי שהמעבר בין
 * מסכים ירגיש אחיד ולא "קופץ".
 */
export function BottomSheet({ onClose, children, zIndex = 60 }: BottomSheetProps) {
  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="fixed inset-0 flex items-end justify-center bg-black/50" style={{ zIndex }} onClick={handleBackdropClick}>
      <div className="flex h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-card bg-bg">
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-pill bg-ink-secondary/30" />
        <div className="flex-1 overflow-y-auto pb-28">{children}</div>
      </div>
    </div>
  );
}
