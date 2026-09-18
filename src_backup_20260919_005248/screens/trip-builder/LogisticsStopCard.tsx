"use client";

import type { FinalItineraryStop } from "@/services/tripBuilder/types";

interface LogisticsStopCardProps {
  stop: FinalItineraryStop;
}

const RIDE_BUTTON_LABEL: Record<string, string> = {
  landing: "הזמנת נסיעה למלון",
  hotel_checkout: "הזמנת נסיעה לשדה התעופה",
};

/**
 * כרטיס תצוגה לתחנות לוגיסטיקה (נחיתה בשדה תעופה, צ'ק-אין/אאוט במלון, טיסת
 * חזרה) - לא ניתנות לגרירה, לא ניתנות למחיקה בסוויפ, אין להן TRIPPY. שונות
 * מספיק מכרטיס מקום רגיל (SortableStopCard) כדי להיות קומפוננטה נפרדת,
 * במקום להעמיס על SortableStopCard תנאים נוספים שלא רלוונטיים לרוב הכרטיסים.
 */
export function LogisticsStopCard({ stop }: LogisticsStopCardProps) {
  const rideLabel = stop.specialType ? RIDE_BUTTON_LABEL[stop.specialType] : undefined;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
      <div className="flex gap-3 p-3">
        {stop.imageUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stop.imageUrls[0]} alt={stop.name} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="h-24 w-24 shrink-0 rounded-xl bg-bg-secondary" />
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div>
            <p className="truncate text-[15px] font-semibold text-ink">{stop.name}</p>
            {stop.shortDescription && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-secondary">{stop.shortDescription}</p>
            )}
          </div>

          {/* כפתור הזמנת נסיעה - עכשיו בתוך אותה שורה (ליד התמונה), לא
              שורה נפרדת מתחת - כדי שהכרטיס לא "יתפח" בגובה מעבר לתמונה. */}
          {stop.directionsUrl && rideLabel && (
            <a
              href={stop.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              🚗 {rideLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
