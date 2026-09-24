"use client";

import { useRef, useState, type ReactNode, type MouseEvent, type PointerEvent } from "react";

interface BottomSheetProps {
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
  /** אזור קבוע בתחתית ה-Sheet (מחוץ לגלילה) - למשל כפתורי "איפוס / החל".
   *  לא מועבר = ההתנהגות הקיימת ללא שינוי. */
  footer?: ReactNode;
  /** *** תוספת (בקשה מפורשת - הפופאפים שנפתחים מעמוד "תוכן" השחור צריכים
   *  להיות שחורים גם הם, ולא לבנים כמו בכל שאר האפליקציה): כשמועבר true -
   *  כרטיס ה-Sheet עצמו כהה (במקום bg-bg הלבן) וידית הגרירה בגוון בהיר עליו.
   *  ברירת מחדל false - כל שאר השימושים הקיימים ב-BottomSheet לא מושפעים. */
  dark?: boolean;
}

const DRAG_CLOSE_THRESHOLD_PX = 100;

/**
 * תיקון (בקשה מפורשת - "שיהיה בר תחתון בכל העמודים שבהם מופיע חלון
 * קופץ!"): ברירת המחדל הישנה (zIndex=60) הייתה **מעל** ה-Bottom Nav
 * (z-50, ר' BottomNav.tsx) - ה-backdrop הכהה של ה-Sheet כיסה את כל
 * המסך כולל אזור הבר התחתון, ולכן הוא נראה "נעלם" (בפועל רק מוסתר
 * מאחורי השכבה הכהה). היה כבר תקדים בקוד לזה בדיוק - DateRangePicker.tsx
 * כבר קבע zIndex={40} (מתחת לבר) עבור עצמו, עם הערה "כאן, ורק כאן" -
 * עכשיו זו ברירת המחדל בשביל כולם, לא חריג בודד. mb (על כרטיס ה-Sheet
 * עצמו, לא על ה-backdrop) משאיר רווח בגובה הבר התחתון כדי שהכרטיס
 * הלבן לא "יתלבש" ויכסה את הבר שעכשיו גלוי מתחתיו.
 */
export function BottomSheet({ onClose, children, zIndex = 40, footer, dark = false }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleHandlePointerDown(e: PointerEvent<HTMLDivElement>) {
    dragStartY.current = e.clientY;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleHandlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (dragStartY.current == null) return;
    const delta = e.clientY - dragStartY.current;
    setDragY(Math.max(0, delta));
  }

  function handleHandlePointerUp() {
    if (dragStartY.current == null) return;
    dragStartY.current = null;
    setDragging(false);
    if (dragY > DRAG_CLOSE_THRESHOLD_PX) {
      onClose();
    } else {
      setDragY(0);
    }
  }

  return (
    <div className="fixed inset-0 flex items-end justify-center bg-black/50" style={{ zIndex }} onClick={handleBackdropClick}>
      <div
        className={`mb-[98px] flex max-h-[calc(90dvh-98px)] w-full max-w-xl flex-col overflow-hidden rounded-t-card ${dark ? "bg-[#141416]" : "bg-bg"}`}
        style={{ transform: `translateY(${dragY}px)`, transition: dragging ? "none" : "transform 0.2s ease-out" }}
      >
        <div
          onPointerDown={handleHandlePointerDown}
          onPointerMove={handleHandlePointerMove}
          onPointerUp={handleHandlePointerUp}
          onPointerCancel={handleHandlePointerUp}
          className="flex shrink-0 cursor-grab touch-none items-center justify-center py-3 active:cursor-grabbing"
        >
          <div className={`h-1 w-10 rounded-pill ${dark ? "bg-white/25" : "bg-ink-secondary/30"}`} />
        </div>
        <div className={`min-h-0 overflow-y-auto ${footer ? "" : "pb-6"}`}>{children}</div>
        {footer && (
          <div
            className={`shrink-0 border-t px-5 pb-4 pt-3 shadow-[0_-10px_24px_-14px_rgba(26,26,46,0.22)] ${
              dark ? "border-white/10 bg-[#141416]" : "border-ink-secondary/10 bg-bg"
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
