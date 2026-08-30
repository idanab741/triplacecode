"use client";

import { useRef, useState, useCallback, useEffect } from "react";

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
    updateFromClientX(e.clientX);
    setDragging(true);
  }

  // תיקון באג אמיתי (בקשה מפורשת - "העיגול תקוע, לא זז בכלל"): קודם
  // pointermove/pointerup היו מוגדרים כ-handlers רגילים על ה-div של
  // המסילה עצמה (onPointerMove/onPointerUp), בהסתמכות על setPointerCapture
  // כדי שאירועים ימשיכו להגיע גם כשהאצבע זזה מחוץ לגבולות האלמנט. זה
  // תלוי בכך שאותו DOM node בדיוק (זה שקיבל pointerdown) יישאר קיים
  // וללא שינוי לאורך כל הגרירה - בתוך הצ'אט הזה, שמלא ב-setTimeout של
  // הדמיית הקלדה/בועות שמחליפות איזה בלוק בדיוק מוצג, גרירה שנמשכת כמה
  // שברירי שנייה יכולה "לתפוס" בדיוק בזמן re-render כזה ולאבד את
  // ה-capture - ואז שום pointermove נוסף לא מגיע לשום מקום, והעיגול
  // פשוט קופא במקום. הפתרון הסטנדרטי והחסין ביותר: להאזין ל-pointermove/
  // pointerup ברמת ה-window כל עוד dragging=true (לא תלוי ב-DOM node
  // ספציפי, ולא ב-setPointerCapture בכלל) - וה-useEffect עצמו כבר דואג
  // לניקוי ה-listeners בסיום הגרירה או אם הקומפוננטה מתעדכנת.
  useEffect(() => {
    if (!dragging) return;

    function handleMove(e: PointerEvent) {
      updateFromClientX(e.clientX);
    }
    function handleUp() {
      setDragging(false);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dragging, updateFromClientX]);

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
