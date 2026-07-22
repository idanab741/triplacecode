"use client";

import { useState } from "react";
import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FinalItinerary, FinalItineraryStop } from "@/services/tripBuilder/types";

interface SortableStopCardProps {
  stop: FinalItineraryStop;
  sessionId: string | null;
  onItineraryUpdate: (itinerary: FinalItinerary) => void;
}

function priceLevelSymbols(level: number | null): string | null {
  if (level == null) return null;
  return "₪".repeat(Math.max(1, level + 1));
}

/** כרטיס תחנה נקי ומעוצב, ניתן לגרירה, עם נקודת כניסה אחת בלבד (TRIPPY) לשינויים. */
export function SortableStopCard({ stop, sessionId, onItineraryUpdate }: SortableStopCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.stopId });

  const [instructOpen, setInstructOpen] = useState(false);
  const [instructText, setInstructText] = useState("");
  const [instructLoading, setInstructLoading] = useState(false);
  const [instructError, setInstructError] = useState<string | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  async function submitInstruction(text: string) {
    if (!sessionId || !text.trim() || instructLoading) return;
    setInstructLoading(true);
    setInstructError(null);
    try {
      const response = await fetch(
        `/api/trip-builder/sessions/${sessionId}/stops/${stop.stopId}/instruct`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instruction: text }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "לא הצלחנו לבצע את השינוי");
      onItineraryUpdate(data.itinerary);
      setInstructOpen(false);
      setInstructText("");
    } catch (error) {
      setInstructError(error instanceof Error ? error.message : "לא הצלחנו לבצע את השינוי");
    } finally {
      setInstructLoading(false);
    }
  }

  const price = priceLevelSymbols(stop.priceLevel);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative overflow-hidden rounded-2xl bg-white shadow-soft transition"
    >
      <div className="flex gap-3 p-3">
        {stop.imageUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stop.imageUrls[0]} alt={stop.name} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="h-24 w-24 shrink-0 rounded-xl bg-bg-secondary" />
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-[15px] font-semibold text-ink">{stop.name}</p>

          {stop.shortDescription && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-secondary">{stop.shortDescription}</p>
          )}

          <div className="mt-auto flex items-center gap-3 pt-1.5 text-xs text-ink-secondary">
            {stop.rating != null && <span>⭐ {stop.rating}</span>}
            {price && <span className="text-ink-secondary/80">{price}</span>}
          </div>
        </div>

        {/* ידית גרירה - מעל התמונה, לא מתנגשת עם דבר */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute right-4 top-4 flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-full bg-white/90 text-sm text-ink-secondary/60 shadow-sm backdrop-blur active:cursor-grabbing"
          aria-label="גרור לשינוי סדר"
        >
          ⠿
        </button>

{/* TRIPPY - נקודת הכניסה היחידה לשינוי התחנה. מוסתר כשהתיבה כבר פתוחה, כדי לא להתנגש איתה */}
        {!instructOpen && (
          <button
            type="button"
            onClick={() => setInstructOpen(true)}
            className="absolute bottom-1.5 left-1.5 flex shrink-0 items-center gap-1 rounded-pill bg-white/90 py-0.5 pl-2 pr-1 shadow-sm backdrop-blur"
            aria-label="שנה תחנה עם TRIPPY"
          >
            <Image src="/images/tripy.png" alt="" width={22} height={22} className="rounded-full" />
            <span className="text-[10px] font-medium text-ink-secondary">שנה</span>
          </button>
        )}
      </div>

{instructOpen && (
        <div className="flex items-center gap-2 border-t border-ink-secondary/10 bg-bg-secondary/40 p-2.5">
          <button
            type="button"
            onClick={() => setInstructOpen(false)}
            className="shrink-0 text-lg leading-none text-ink-secondary/60"
            aria-label="סגור"
          >
            ✕
          </button>
          <button
            type="button"
            onClick={() => submitInstruction("תחליף את התחנה הזו במשהו אחר")}
            disabled={instructLoading}
            className="shrink-0 rounded-pill border border-accent/30 bg-white px-2.5 py-2 text-[11px] font-medium text-accent disabled:opacity-50 whitespace-nowrap"
          >
            🔄 {instructLoading ? "מחליף..." : "החלף"}
          </button>
          <input
            type="text"
            value={instructText}
            onChange={(e) => setInstructText(e.target.value)}
            placeholder='או כתבו בדיוק מה תרצו לשנות...'
            className="min-w-0 flex-1 rounded-pill border border-ink-secondary/20 bg-white px-3 py-2 text-xs text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="button"
            onClick={() => submitInstruction(instructText)}
            disabled={instructLoading || !instructText.trim()}
            className="shrink-0 rounded-pill px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
          >
            שלח
          </button>
        </div>
      )}
      {instructError && <p className="px-3 pb-2 text-xs text-danger">{instructError}</p>}
    </div>
  );
}