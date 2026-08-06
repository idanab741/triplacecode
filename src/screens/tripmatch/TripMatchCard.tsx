"use client";

import { getCategoryLabel } from "@/utils/categoryLabels";
import type { CandidatePlace } from "@/services/tripBuilder/types";

const MAX_REASONABLE_DRIVING_KM = 400; // מעבר לזה, "X דק' נסיעה" כבר לא כנה - צריך טיסה

interface TripMatchCardProps {
  candidate: CandidatePlace;
}

const TAG_LABELS: Record<string, string> = {
  parking: "🅿️ חניה",
  kid_friendly: "👨‍👩‍👧 מתאים לילדים",
  accessible: "♿ נגיש",
  water: "💧 מים",
  dogs: "🐶 כלבים",
  shaded: "🌳 מוצל",
};

/** תגיות קצרות מתחת לתיאור - נגזרות מהשדות האמיתיים שכבר קיימים על המועמד,
 *  לא ממציאות מידע שאין. */
function deriveTags(candidate: CandidatePlace): string[] {
  const tags: string[] = [];
  if (candidate.accessible) tags.push(TAG_LABELS.accessible);
  if (candidate.kosher) tags.push("✡️ כשר");
  if (candidate.suitableChildAges.length > 0) tags.push(TAG_LABELS.kid_friendly);
  return tags;
}

/** כרטיס ההחלקה - תופס כמעט את כל המסך, מיועד להחלטה מהירה בלבד: תמונה,
 *  שם, קטגוריה, דירוג, זמן/מרחק, מחיר, תיאור קצר, ותגיות רלוונטיות בלבד. */
export function TripMatchCard({ candidate }: TripMatchCardProps) {
  const tags = deriveTags(candidate);

  return (
    <div className="relative flex h-[calc(100dvh-340px)] min-h-[380px] w-full flex-col overflow-hidden rounded-card bg-white shadow-soft">
      <div className="relative flex-1 bg-bg-secondary">
        {candidate.imageUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={candidate.imageUrls[0]} alt={candidate.name} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">📍</div>
        )}
        {/* גרדיאנט תחתון - מבטיח שהטקסט הלבן קריא גם על תמונה בהירה */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,rgba(0,0,0,0.72),transparent)]" />

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 px-5 pb-5 text-white">
          <div className="flex items-center gap-2 text-xs font-medium text-white/85">
            <span>{getCategoryLabel(candidate.category)}</span>
            {candidate.rating != null && (
              <>
                <span className="opacity-60">•</span>
                <span>⭐ {candidate.rating.toFixed(1)}</span>
              </>
            )}
          </div>
          <h2 className="text-xl font-extrabold leading-tight">{candidate.name}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-white/90">
            {candidate.distanceKm > 0 &&
              (candidate.distanceKm <= MAX_REASONABLE_DRIVING_KM ? (
                <>
                  <span>🚗 {candidate.etaMinutes} דק&apos;</span>
                  <span>📍 {candidate.distanceKm.toFixed(1)} ק&quot;מ</span>
                </>
              ) : (
                <span>✈️ {Math.round(candidate.distanceKm).toLocaleString()} ק&quot;מ ממך</span>
              ))}
            {candidate.priceLevel != null && <span>{"₪".repeat(candidate.priceLevel + 1)}</span>}
          </div>
        </div>
      </div>

      {(candidate.shortDescription || tags.length > 0) && (
        <div className="flex flex-col gap-2.5 px-5 py-4">
          {candidate.shortDescription && (
            <p className="line-clamp-2 text-[13.5px] leading-relaxed text-ink-secondary">{candidate.shortDescription}</p>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="rounded-pill bg-bg-secondary px-2.5 py-1 text-[11.5px] font-medium text-ink-secondary">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
