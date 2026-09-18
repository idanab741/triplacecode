"use client";

import { useRef, useState, type ReactNode, type MouseEvent, type PointerEvent } from "react";

interface BottomSheetProps {
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
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
export function BottomSheet({ onClose, children, zIndex = 40 }: BottomSheetProps) {
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
        className="mb-[88px] flex max-h-[calc(90dvh-88px)] w-full max-w-xl flex-col overflow-hidden rounded-t-card bg-bg"
        style={{ transform: `translateY(${dragY}px)`, transition: dragging ? "none" : "transform 0.2s ease-out" }}
      >
        <div
          onPointerDown={handleHandlePointerDown}
          onPointerMove={handleHandlePointerMove}
          onPointerUp={handleHandlePointerUp}
          onPointerCancel={handleHandlePointerUp}
          className="flex shrink-0 cursor-grab touch-none items-center justify-center py-3 active:cursor-grabbing"
        >
          <div className="h-1 w-10 rounded-pill bg-ink-secondary/30" />
        </div>
        <div className="overflow-y-auto pb-6">{children}</div>
      </div>
    </div>
  );
}
