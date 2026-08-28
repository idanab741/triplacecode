"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TrippyQuickStop } from "@/app/api/trip-builder/trippy-quick/route";

interface TrippyQuickStopCardProps {
  stop: TrippyQuickStop;
  onDelete: () => void;
}

const CATEGORY_LABEL: Record<TrippyQuickStop["category"], string> = {
  attraction: "🎡 אטרקציה",
  restaurant: "🍽️ מסעדה",
};

/** כרטיס תחנה פשוט לעמוד המסלול המהיר החדש - גרירה + מחיקה בכפתור
 *  ישיר (לא סוויפ, בכוונה - זו רשימה קצרה של עד 6 פריטים, לא צריך
 *  את המורכבות של SortableStopCard, שגם ממילא תלוי ב-sessionId/API
 *  שלא קיימים כאן). */
export function TrippyQuickStopCard({ stop, onDelete }: TrippyQuickStopCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-3 rounded-card bg-white p-3 shadow-soft">
      {stop.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={stop.imageUrl} alt={stop.name} className="h-20 w-24 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-2xl">
          {stop.category === "restaurant" ? "🍽️" : "📍"}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="text-[11px] font-medium text-accent">{CATEGORY_LABEL[stop.category]}</p>
        <p className="truncate text-[15px] font-bold text-ink">{stop.name}</p>
        {stop.shortDescription && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-secondary">{stop.shortDescription}</p>
        )}
        <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-ink-secondary">
          {stop.rating != null && <span>⭐ {stop.rating}</span>}
          {stop.address && <span className="truncate">{stop.address}</span>}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center justify-between">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-full bg-bg-secondary text-sm text-ink-secondary/60 active:cursor-grabbing"
          aria-label="גרור לשינוי סדר"
        >
          ⠿
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-danger/10 text-sm text-danger"
          aria-label="מחק תחנה"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
