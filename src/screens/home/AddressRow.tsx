"use client";

import { useEffect, useRef, useState } from "react";
import type { UserAddress } from "@/services/addresses/addressesService";

interface AddressRowProps {
  address: UserAddress;
  onSelect: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

const SWIPE_REVEAL_PX = 88;

/** שורת כתובת עם סוויפ-לחשיפה (ימינה, כמו במסך "תוצאת חופשה בחו״ל" -
 *  SortableStopCard) - חושף אייקון "הפוך לבית/ברירת מחדל" ומחיקה, במקום
 *  כפתור טקסט קבוע. */
export function AddressRow({ address, onSelect, onSetDefault, onDelete }: AddressRowProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [swipeOpen, setSwipeOpen] = useState(false);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeStartOffset = useRef(0);
  const swipeDirection = useRef<"horizontal" | "vertical" | null>(null);

  function handlePointerDown(e: React.PointerEvent) {
    swipeStartX.current = e.clientX;
    swipeStartY.current = e.clientY;
    swipeStartOffset.current = swipeOpen ? SWIPE_REVEAL_PX : 0;
    swipeDirection.current = null;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (swipeStartX.current == null || swipeStartY.current == null) return;
    const deltaX = e.clientX - swipeStartX.current;
    const deltaY = e.clientY - swipeStartY.current;

    if (swipeDirection.current == null) {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      swipeDirection.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      if (swipeDirection.current === "horizontal") {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
    }
    if (swipeDirection.current !== "horizontal") return;

    const next = Math.max(0, Math.min(SWIPE_REVEAL_PX, swipeStartOffset.current + deltaX));
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
    setSwipeX(shouldOpen ? SWIPE_REVEAL_PX : 0);
  }

  // אם הכתובת כבר ברירת מחדל, אין טעם לחשוף "הפוך לברירת מחדל" - רק מחיקה.
  useEffect(() => {
    if (address.is_default) {
      setSwipeOpen(false);
      setSwipeX(0);
    }
  }, [address.is_default]);

  return (
    <div className="relative overflow-hidden border-t border-ink-secondary/10">
      {/* פאנל החשיפה - יושב מתחת לכרטיס, נחשף כשהכרטיס נגרר ימינה */}
      <div className="absolute inset-y-0 start-0 flex" style={{ width: SWIPE_REVEAL_PX }}>
        {!address.is_default && (
          <button
            type="button"
            onClick={() => {
              onSetDefault();
              setSwipeOpen(false);
              setSwipeX(0);
            }}
            aria-label="הפוך לברירת מחדל"
            className="flex flex-1 items-center justify-center bg-accent text-xl text-white"
          >
            🏠
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onDelete();
            setSwipeOpen(false);
            setSwipeX(0);
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ transform: `translateX(${-swipeX}px)`, transition: swipeX === 0 || swipeX === SWIPE_REVEAL_PX ? "transform 0.2s ease-out" : "none" }}
        className="relative flex items-center gap-3 bg-bg px-5 py-3.5 touch-pan-y"
      >
        <button type="button" onClick={onSelect} className="flex flex-1 items-center gap-3 text-start">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg"
            style={{
              background: address.is_default ? "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" : "var(--color-bg-secondary)",
              color: address.is_default ? "#fff" : "var(--color-ink-secondary)",
            }}
          >
            📍
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 truncate text-[15px] font-semibold text-ink">
              {address.label}
              {address.is_default && <span className="text-accent">✓</span>}
            </span>
            {address.city && <span className="block truncate text-[13px] text-ink-secondary">{address.city}</span>}
          </span>
        </button>
      </div>
    </div>
  );
}
