"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { AddToSheet } from "./AddToSheet";
import { prepareNewMap, prepareNewTrip, resolveCollectablePlaces } from "./placeTargets";

type Target = "collection" | "trip";

/**
 * *** בקשה מפורשת ("בחירה מרובה - לבחור כמה אטרקציות / נעצים במפה ואז ליצור אוסף חדש / מסלול"):
 * הבר שמופיע בתחתית בזמן בחירה מרובה - "נבחרו N" + "אוסף חדש" / "מסלול חדש". הלחיצה:
 *  1. ממירה את המזהים ל-Places אמיתיים (POST /api/places/collectable - גם מקומות קהילה),
 *  2. ממלאת מראש את טיוטת טופס היצירה (אותה טיוטה שהטופס כבר יודע לשחזר),
 *  3. עוברת לעמוד היצירה - שם רק נותנים שם ומפרסמים.
 */
export function SelectionActionBar({
  selectedIds,
  onCancel,
  accent = "#0A6DFE",
  labels = { collection: "מפה חדשה", trip: "טיול חדש" },
  allowEmpty = false,
  allowAddToExisting = true,
  style,
  className = "",
}: {
  selectedIds: string[];
  /** בלי onCancel - אין כפתור ✕ (למשל כשאין מה לבטל) */
  onCancel?: () => void;
  accent?: string;
  labels?: { collection: string; trip: string };
  /** אפשר ליצור גם בלי מקומות שנבחרו - פשוט עוברים לעמוד היצירה הריק */
  allowEmpty?: boolean;
  /** השורה "הוספה למפה או טיול קיימים" (לא מוצגת בעמוד התוכן - שם יוצרים חדש) */
  allowAddToExisting?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addToOpen, setAddToOpen] = useState(false);
  const count = selectedIds.length;

  async function create(target: Target) {
    if (busy) return;
    if (count === 0) {
      if (allowEmpty) router.push(target === "collection" ? "/places/collection/create?type=places" : "/places/trip/create");
      return;
    }
    setBusy(target);
    setError(null);
    try {
      const places = await resolveCollectablePlaces(selectedIds);
      router.push(target === "collection" ? prepareNewMap(places) : prepareNewTrip(places));
    } catch (e) {
      setError(e instanceof Error ? e.message : "משהו השתבש, נסו שוב");
      setBusy(null);
    }
  }

  const spinner = <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;

  return (
    <div
      className={`rounded-[22px] bg-white p-2.5 ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(15,20,25,0.10),0_10px_28px_-8px_rgba(15,20,25,0.3)] ${className}`}
      style={style}
      role="region"
      aria-label="בחירה מרובה"
    >
      <div className="flex items-center gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="ביטול הבחירה"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F1F2F5] text-ink transition active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
        <span className={`min-w-0 flex-1 truncate text-[14.5px] font-bold text-ink ${onCancel ? "" : "ps-2"}`} aria-live="polite">
          {count === 0 ? "בחרו מקומות" : count === 1 ? "נבחר 1" : `נבחרו ${count}`}
        </span>
        <button
          type="button"
          disabled={(count === 0 && !allowEmpty) || busy !== null}
          onClick={() => create("collection")}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#F1F2F5] px-3.5 text-[13.5px] font-semibold text-ink transition active:scale-95 disabled:opacity-45"
        >
          {busy === "collection" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-ink" /> : null}
          {labels.collection}
        </button>
        <button
          type="button"
          disabled={(count === 0 && !allowEmpty) || busy !== null}
          onClick={() => create("trip")}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold text-white transition active:scale-95 disabled:opacity-45"
          style={{ background: accent }}
        >
          {busy === "trip" ? spinner : null}
          {labels.trip}
        </button>
      </div>
      {/* *** בקשה מפורשת ("להוסיף למפה / לטיול קיימים"): כשנבחר משהו - גם הוספה למה שכבר יצרתם */}
      {count > 0 && allowAddToExisting && (
        <button
          type="button"
          onClick={() => setAddToOpen(true)}
          disabled={busy !== null}
          className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[13.5px] font-semibold transition active:bg-[#F1F2F5] disabled:opacity-45"
          style={{ color: accent }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          הוספה למפה או טיול קיימים
        </button>
      )}
      {error && <p className="px-1 pt-2 text-[12.5px] text-danger">{error}</p>}
      {addToOpen && <AddToSheet ids={selectedIds} label={count === 1 ? "מקום אחד" : `${count} מקומות`} onClose={() => setAddToOpen(false)} />}
    </div>
  );
}
