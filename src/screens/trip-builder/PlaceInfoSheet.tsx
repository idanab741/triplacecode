import { getCategoryLabel } from "@/utils/categoryLabels";
import type { CandidatePlace } from "@/services/tripBuilder/types";

interface PlaceInfoSheetProps {
  candidate: CandidatePlace;
  onClose: () => void;
}

/** Bottom sheet עם מידע נוסף על המקום - נשאר בתוך מסך ההחלקה, לא ניווט לעמוד נפרד. */
export function PlaceInfoSheet({ candidate, onClose }: PlaceInfoSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-t-card bg-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-pill bg-ink-secondary/30" />

        {candidate.imageUrls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.imageUrls[0]}
            alt={candidate.name}
            className="mb-4 h-48 w-full rounded-card object-cover"
          />
        )}

        <h2 className="text-lg font-bold text-ink">{candidate.name}</h2>
        <p className="text-sm text-ink-secondary">{getCategoryLabel(candidate.category)}</p>

        {candidate.shortDescription && (
          <p className="mt-3 text-sm text-ink">{candidate.shortDescription}</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-ink">
          <span>מרחק: {candidate.distanceKm.toFixed(1)} ק&quot;מ</span>
          <span>זמן נסיעה: {candidate.etaMinutes} דק&apos;</span>
          {candidate.estimatedVisitMinutes && (
            <span>משך ביקור: {candidate.estimatedVisitMinutes} דק&apos;</span>
          )}
          {candidate.rating != null && (
            <span>
              דירוג: {candidate.rating} ({candidate.ratingCount ?? 0} ביקורות)
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-pill bg-bg-secondary py-3 text-sm font-medium text-ink"
        >
          סגירה
        </button>
      </div>
    </div>
  );
}
