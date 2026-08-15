"use client";

import { useRef, useState, type ReactNode } from "react";

interface SwipeUpToDeleteCardProps {
  onDelete: () => void;
  children: ReactNode;
  className?: string;
}

const DELETE_THRESHOLD_PX = 60;
const FLY_DISTANCE_PX = 260;

export function SwipeUpToDeleteCard({ onDelete, children, className = "" }: SwipeUpToDeleteCardProps) {
  const [dragY, setDragY] = useState(0);
  const [flying, setFlying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const direction = useRef<"vertical" | "horizontal" | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    startY.current = e.clientY;
    direction.current = null;
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (startX.current == null || startY.current == null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (direction.current == null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      direction.current = Math.abs(dy) > Math.abs(dx) ? "vertical" : "horizontal";
      if (direction.current === "vertical") {
        trackRef.current?.setPointerCapture(e.pointerId);
      }
    }
    if (direction.current !== "vertical") return;

    setDragY(Math.min(0, dy));
  }

  function handlePointerUp() {
    const wasVertical = direction.current === "vertical";
    startX.current = null;
    startY.current = null;
    direction.current = null;
    setDragging(false);
    if (!wasVertical) return;

    if (-dragY > DELETE_THRESHOLD_PX) {
      setFlying(true);
      setDragY(-FLY_DISTANCE_PX);
      window.setTimeout(onDelete, 220);
    } else {
      setDragY(0);
    }
  }

  const revealProgress = Math.min(1, -dragY / DELETE_THRESHOLD_PX);

  return (
    <div className={`relative w-full ${className}`}>
      <div
        className="absolute inset-0 flex items-end justify-center rounded-card bg-danger"
        style={{ opacity: revealProgress }}
      >
        <div className="flex flex-col items-center gap-1 pb-3 text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
          </svg>
        </div>
      </div>

      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateY(${dragY}px)`,
          opacity: flying ? 0 : 1,
          transition: dragging ? "none" : "transform 0.22s ease-out, opacity 0.22s ease-out",
          touchAction: "pan-x",
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}
