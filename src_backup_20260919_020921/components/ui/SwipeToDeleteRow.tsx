"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface SwipeToDeleteRowProps {
  onDelete: () => void;
  children: ReactNode;
  resetKey?: string;
}

const SWIPE_REVEAL_PX = 76;
// פס אדום קבוע ותמיד גלוי בקצה, גם במנוחה - לפי בקשה מפורשת, אחיד בכל
// מקום באפליקציה בעובי 3px (היה 6px, הצטמצם כדי להיות עקבי עם שאר
// הכרטיסים - עמודי המסלול, "הטיולים שלי", tripmatch - כולם באותו עובי).
const REST_PEEK_PX = 3;
// "dead zone" קטן כדי שרעד טבעי של האצבע בתחילת מגע לא יגרום לזיהוי
// כיוון שגוי, עקבי עם אותו הרעיון ב-SwipeUpToDeleteCard.tsx.
const DIRECTION_DEAD_ZONE_PX = 6;
const SNAP_TRANSITION = "transform 0.2s ease-out";

export function SwipeToDeleteRow({ onDelete, children, resetKey }: SwipeToDeleteRowProps) {
  // תיקון ביצועים (audit gesture pipeline): קודם swipeX היה React state
  // שמתעדכן בכל pointermove -> re-render בכל פריים של הגרירה. עכשיו זה
  // ref בלבד; ה-DOM מתעדכן ישירות דרך transform, וה-React state
  // (swipeOpen) משמש רק למצב הסופי: פתוח/סגור.
  const [swipeOpen, setSwipeOpen] = useState(false);

  const swipeX = useRef(REST_PEEK_PX);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeStartOffset = useRef(REST_PEEK_PX);
  const swipeDirection = useRef<"horizontal" | "vertical" | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);
  const pendingX = useRef<number | null>(null);

  function applyTransform(x: number, withTransition: boolean) {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = withTransition ? SNAP_TRANSITION : "none";
    el.style.transform = `translateX(${-x}px)`;
  }

  // מיישרים את עדכוני ה-DOM לפריים הבא (rAF), עקבי עם SwipeUpToDeleteCard.
  function scheduleTransform(x: number) {
    pendingX.current = x;
    if (rafId.current != null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (pendingX.current != null) applyTransform(pendingX.current, false);
    });
  }

  function cancelScheduledTransform() {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }

  useEffect(() => cancelScheduledTransform, []);

  useEffect(() => {
    cancelScheduledTransform();
    swipeX.current = REST_PEEK_PX;
    setSwipeOpen(false);
    applyTransform(REST_PEEK_PX, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  function handlePointerDown(e: React.PointerEvent) {
    swipeStartX.current = e.clientX;
    swipeStartY.current = e.clientY;
    swipeStartOffset.current = swipeOpen ? SWIPE_REVEAL_PX : REST_PEEK_PX;
    swipeDirection.current = null;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (swipeStartX.current == null || swipeStartY.current == null) return;
    const deltaX = e.clientX - swipeStartX.current;
    const deltaY = e.clientY - swipeStartY.current;

    if (swipeDirection.current == null) {
      if (Math.abs(deltaX) < DIRECTION_DEAD_ZONE_PX && Math.abs(deltaY) < DIRECTION_DEAD_ZONE_PX) return;
      swipeDirection.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      if (swipeDirection.current === "horizontal") {
        // תיקון עקביות (audit §7): קודם ה-pointer capture בקומפוננטה הזו
        // היה קורה מיד ב-pointerdown, בלי קשר לכיוון שהתגלה בסוף - לא
        // עקבי עם SwipeUpToDeleteCard, ששם הקאפצ'ר תמיד חיכה לנעילת
        // כיוון. עכשיו שני הרכיבים עוקבים אחרי אותו pipeline:
        // pointerdown -> direction detection -> gesture lock -> pointer capture -> drag.
        trackRef.current?.setPointerCapture(e.pointerId);
      }
    }
    if (swipeDirection.current !== "horizontal") return;

    const next = Math.max(REST_PEEK_PX, Math.min(SWIPE_REVEAL_PX, swipeStartOffset.current - deltaX));
    swipeX.current = next;
    scheduleTransform(next);
  }

  function handlePointerUp() {
    if (swipeStartX.current == null) return;
    const wasHorizontal = swipeDirection.current === "horizontal";
    swipeStartX.current = null;
    swipeStartY.current = null;
    swipeDirection.current = null;
    if (!wasHorizontal) return;

    cancelScheduledTransform();

    const shouldOpen = swipeX.current > SWIPE_REVEAL_PX / 2;
    const target = shouldOpen ? SWIPE_REVEAL_PX : REST_PEEK_PX;
    swipeX.current = target;
    applyTransform(target, true);
    setSwipeOpen(shouldOpen);
  }

  return (
    <div className="relative overflow-hidden rounded-card">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: SWIPE_REVEAL_PX }}>
        <button
          type="button"
          onClick={() => {
            onDelete();
            swipeX.current = REST_PEEK_PX;
            setSwipeOpen(false);
            applyTransform(REST_PEEK_PX, true);
          }}
          aria-label="מחיקה"
          className="flex flex-1 items-center justify-center bg-danger text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
          </svg>
        </button>
      </div>

      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateX(${-(swipeOpen ? SWIPE_REVEAL_PX : REST_PEEK_PX)}px)`,
          transition: SNAP_TRANSITION,
        }}
        className="relative touch-pan-y bg-bg"
      >
        {children}
      </div>
    </div>
  );
}
