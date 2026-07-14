"use client";

import { useRef, type ReactNode } from "react";

interface SwipeCardProps {
  children: ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  disabled?: boolean;
}

const SWIPE_THRESHOLD_PX = 100;
const FLY_OUT_DISTANCE_PX = 500;

/**
 * כרטיס נגרר (Like ימינה, Unlike שמאלה) - pointer events + CSS transform,
 * בלי ספריית gesture חיצונית. הרכיב תלוי בכך שההורה יעביר key ייחודי לכל
 * מועמד (כדי שהכרטיס יתחיל מאפס בכל מיפוי מחדש).
 */
export function SwipeCard({ children, onSwipeLeft, onSwipeRight, disabled }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ startX: 0, currentX: 0, dragging: false, pointerId: -1 });

  function setTransform(x: number, withTransition: boolean) {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = withTransition ? "transform 0.3s ease, opacity 0.3s ease" : "none";
    el.style.transform = `translateX(${x}px) rotate(${x / 20}deg)`;
    el.style.opacity = `${Math.max(0, 1 - Math.abs(x) / (FLY_OUT_DISTANCE_PX * 1.5))}`;
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (disabled) return;
    dragState.current = { startX: e.clientX, currentX: 0, dragging: true, pointerId: e.pointerId };
    cardRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current.dragging) return;
    const deltaX = e.clientX - dragState.current.startX;
    dragState.current.currentX = deltaX;
    setTransform(deltaX, false);
  }

  function handlePointerUp() {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;

    const deltaX = dragState.current.currentX;
    if (deltaX > SWIPE_THRESHOLD_PX) {
      flyOut("right");
    } else if (deltaX < -SWIPE_THRESHOLD_PX) {
      flyOut("left");
    } else {
      setTransform(0, true);
    }
  }

  function flyOut(direction: "left" | "right") {
    const distance = direction === "right" ? FLY_OUT_DISTANCE_PX : -FLY_OUT_DISTANCE_PX;
    setTransform(distance, true);
    window.setTimeout(() => {
      if (direction === "right") onSwipeRight();
      else onSwipeLeft();
    }, 250);
  }

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="touch-none select-none"
      style={{ willChange: "transform" }}
    >
      {children}
      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          type="button"
          disabled={disabled}
          onClick={() => flyOut("left")}
          aria-label="לא מתאים"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-secondary text-2xl shadow-soft disabled:opacity-50"
        >
          ❌
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => flyOut("right")}
          aria-label="אהבתי"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-2xl shadow-soft disabled:opacity-50"
        >
          ❤️
        </button>
      </div>
    </div>
  );
}
