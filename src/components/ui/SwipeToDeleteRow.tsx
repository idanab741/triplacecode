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

export function SwipeToDeleteRow({ onDelete, children, resetKey }: SwipeToDeleteRowProps) {
  const [swipeX, setSwipeX] = useState(REST_PEEK_PX);
  const [swipeOpen, setSwipeOpen] = useState(false);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeStartOffset = useRef(REST_PEEK_PX);
  const swipeDirection = useRef<"horizontal" | "vertical" | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSwipeOpen(false);
    setSwipeX(REST_PEEK_PX);
  }, [resetKey]);

  function handlePointerDown(e: React.PointerEvent) {
    swipeStartX.current = e.clientX;
    swipeStartY.current = e.clientY;
    swipeStartOffset.current = swipeOpen ? SWIPE_REVEAL_PX : REST_PEEK_PX;
    swipeDirection.current = null;
    trackRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (swipeStartX.current == null || swipeStartY.current == null) return;
    const deltaX = e.clientX - swipeStartX.current;
    const deltaY = e.clientY - swipeStartY.current;

    if (swipeDirection.current == null) {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      swipeDirection.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }
    if (swipeDirection.current !== "horizontal") return;

    const next = Math.max(REST_PEEK_PX, Math.min(SWIPE_REVEAL_PX, swipeStartOffset.current - deltaX));
    setSwipeX(next);
  }

  function handlePointerUp() {
    if (swipeStartX.current == null) return;
    const wasHorizontal = swipeDirection.current === "horizontal";
    swipeStartX.current = null;
    swipeStartY.current = null;
    swipeDirection.current = null;
    if (!wasHorizontal) return;

    const shouldOpen = swipeX > SWIPE_REVEAL_PX / 2;
    setSwipeOpen(shouldOpen);
    setSwipeX(shouldOpen ? SWIPE_REVEAL_PX : REST_PEEK_PX);
  }

  return (
    <div className="relative overflow-hidden rounded-card">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: SWIPE_REVEAL_PX }}>
        <button
          type="button"
          onClick={() => {
            onDelete();
            setSwipeOpen(false);
            setSwipeX(REST_PEEK_PX);
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
          transform: `translateX(${-swipeX}px)`,
          transition: swipeX === REST_PEEK_PX || swipeX === SWIPE_REVEAL_PX ? "transform 0.2s ease-out" : "none",
        }}
        className="relative touch-pan-y bg-bg"
      >
        {children}
      </div>
    </div>
  );
}
