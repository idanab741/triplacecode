import { getCategoryLabel } from "@/utils/categoryLabels";
import type { CandidatePlace } from "@/services/tripBuilder/types";

interface PlaceSwipeCardContentProps {
  candidate: CandidatePlace;
  onInfoClick: () => void;
}

const PRICE_LEVEL_LABELS = ["חינם", "₪", "₪₪", "₪₪₪", "₪₪₪₪"];

/** תוכן כרטיס ההחלקה: תמונה, שם, סוג, Match Score, מרחק, זמן ביקור, מחיר, דירוג, נימוק. */
export function PlaceSwipeCardContent({ candidate, onInfoClick }: PlaceSwipeCardContentProps) {
  const imageUrl = candidate.imageUrls[0];

  return (
    <div className="relative h-[65vh] max-h-[520px] overflow-hidden rounded-card shadow-soft">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={candidate.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-bg-secondary text-ink-secondary">
          אין תמונה זמינה
        </div>
      )}

      {candidate.score != null && (
        <span className="absolute start-3 top-3 rounded-pill bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] px-3 py-1 text-xs font-bold text-white shadow-soft">
          {candidate.score}% התאמה
        </span>
      )}

      <button
        type="button"
        onClick={onInfoClick}
        aria-label="מידע נוסף"
        className="absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-lg shadow-soft"
      >
        ℹ️
      </button>

      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.75),transparent)] p-4 text-white">
        <p className="text-lg font-bold">{candidate.name}</p>
        <p className="text-sm text-white/85">{getCategoryLabel(candidate.category)}</p>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/85">
          <span>{candidate.distanceKm.toFixed(1)} ק&quot;מ ({candidate.etaMinutes} דק&apos;)</span>
          {candidate.estimatedVisitMinutes && (
            <span>{candidate.estimatedVisitMinutes} דק&apos; ביקור</span>
          )}
          {candidate.priceLevel != null && <span>{PRICE_LEVEL_LABELS[candidate.priceLevel] ?? ""}</span>}
          {candidate.rating != null && <span>⭐ {candidate.rating}</span>}
        </div>

        {candidate.reason && <p className="mt-2 text-sm text-white/90">{candidate.reason}</p>}
      </div>
    </div>
  );
}
