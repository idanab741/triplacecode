"use client";

import { useRef, useState, useCallback } from "react";

interface SliderStep {
  value: string;
  label: string;
}

interface SliderProps {
  steps: SliderStep[];
  value: string;
  onChange: (value: string) => void;
}

/** סליידר עם שלבים בדידים ומתויגים (למשל: מרחק, תקציב). מסילה עבה ובולטת
 *  בסגנון iOS. מחשב מיקום בעצמו (לא מסתמך על native RTL, לא עקבי בין דפדפנים). */
export function Slider({ steps, value, onChange }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const index = Math.max(0, steps.findIndex((step) => step.value === value));
  const percent = steps.length > 1 ? (index / (steps.length - 1)) * 100 : 0;

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      // RTL: 0% בצד ימין, 100% בצד שמאל
      const ratio = 1 - (clientX - rect.left) / rect.width;
      const clamped = Math.min(1, Math.max(0, ratio));
      const newIndex = Math.round(clamped * (steps.length - 1));
      const newStep = steps[newIndex];
      if (newStep && newStep.value !== value) onChange(newStep.value);
    },
    [steps, value, onChange]
  );

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  }
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  }
  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        aria-live="polite"
        style={{
          borderRadius: "999px",
          padding: "11px 20px",
          textAlign: "center",
          fontSize: "16px",
          fontWeight: 700,
          color: "#ffffff",
          background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))",
          boxShadow: "0 6px 16px rgba(24,119,242,0.32)",
        }}
      >
        {steps[index]?.label}
      </div>

      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: "relative",
          height: "44px",
          cursor: "pointer",
          touchAction: "none",
          padding: "0 2px",
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* מסילה - עבה ובולטת, בסגנון iOS */}
        <div
          style={{
            position: "absolute",
            insetInline: "2px",
            top: "50%",
            transform: "translateY(-50%)",
            height: "16px",
            borderRadius: "999px",
            background: `linear-gradient(to left, var(--color-primary-start), var(--color-primary-end) ${percent}%, #e2e6ee ${percent}%)`,
            boxShadow: "inset 0 1.5px 4px rgba(16, 24, 40, 0.18)",
          }}
        />
        {/* כפתור גרירה */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            right: `calc(${percent}% - 18px)`,
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "#ffffff",
            border: "4px solid var(--color-primary-start)",
            boxShadow: dragging
              ? "0 6px 18px rgba(16, 24, 40, 0.4)"
              : "0 4px 10px rgba(16, 24, 40, 0.28)",
            transform: `translateY(-50%) scale(${dragging ? 1.1 : 1})`,
            transition: "transform 0.12s ease, box-shadow 0.12s ease",
            pointerEvents: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--color-ink-secondary, #8a94a6)" }}>
        <span>{steps[0]?.label}</span>
        <span>{steps[steps.length - 1]?.label}</span>
      </div>
    </div>
  );
}
