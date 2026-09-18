"use client";

import { getCategoryLabel } from "@/utils/categoryLabels";
import type { CandidatePlace } from "@/services/tripBuilder/types";

interface TripMatchCardContentProps {
  candidate: CandidatePlace;
}

/** תוכן הכרטיס להחלקה ב-TripMatch - תמונה גדולה, שם, קטגוריה, תיאור ודירוג. */
export function TripMatchCardContent({ candidate }: TripMatchCardContentProps) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-lg">
      <div className="relative h-72 w-full bg-bg-secondary">
        {candidate.imageUrls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={candidate.imageUrls[0]} alt={candidate.name} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="p-4">
        <p className="text-xs font-medium text-ink-secondary">{getCategoryLabel(candidate.category)}</p>
        <p className="mt-0.5 text-lg font-bold text-ink">{candidate.name}</p>
        {candidate.shortDescription && (
          <p className="mt-1 line-clamp-2 text-sm text-ink-secondary">{candidate.shortDescription}</p>
        )}
        <div className="mt-2 flex items-center gap-3 text-sm text-ink-secondary">
          {candidate.rating != null && <span>⭐ {candidate.rating}</span>}
          {candidate.priceLevel != null && <span>{"₪".repeat(candidate.priceLevel + 1)}</span>}
        </div>
      </div>
    </div>
  );
}