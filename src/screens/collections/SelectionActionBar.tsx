"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { COLLECTION_LIMITS } from "@/services/social/collectionTypes";
import { COLLECTION_DRAFT_KEY, TRIP_DRAFT_KEY } from "./createDrafts";
import { formItemKey, type CollectionFormItem } from "./collectionFormTypes";

interface CollectablePlace {
  inputId: string;
  placeId: string;
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
}

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
  style,
  className = "",
}: {
  selectedIds: string[];
  onCancel: () => void;
  accent?: string;
  style?: CSSProperties;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);
  const count = selectedIds.length;

  async function create(target: Target) {
    if (busy || count === 0) return;
    setBusy(target);
    setError(null);
    try {
      const res = await fetch("/api/places/collectable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = (await res.json().catch(() => ({}))) as { places?: CollectablePlace[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "משהו השתבש, נסו שוב");
      const seen = new Set<string>();
      const places = (data.places ?? []).filter((p) => (seen.has(p.placeId) ? false : (seen.add(p.placeId), true)));
      if (places.length === 0) throw new Error("לא הצלחנו להוסיף את המקומות שנבחרו");

      if (target === "collection") {
        const items: CollectionFormItem[] = places.slice(0, COLLECTION_LIMITS.maxItems).map((p) => ({
          key: formItemKey("place", p.placeId),
          kind: "place",
          refId: p.placeId,
          title: p.name,
          subtitle: p.subtitle,
          imageUrl: p.imageUrl,
          note: "",
        }));
        localStorage.setItem(
          COLLECTION_DRAFT_KEY,
          JSON.stringify({ type: "places", title: "", description: "", coverUrl: null, visibility: "public", items })
        );
        router.push("/places/collection/create?type=places");
      } else {
        const stops = places.map((p, i) => ({
          key: `stop-sel-${Date.now().toString(36)}-${i}`,
          placeId: p.placeId,
          title: p.name,
          subtitle: p.subtitle,
          imageUrl: p.imageUrl,
          note: "",
        }));
        sessionStorage.setItem(
          TRIP_DRAFT_KEY,
          JSON.stringify({ title: "", description: "", coverUrl: null, tripType: null, visibility: "public", days: [{ id: `day-sel-${Date.now().toString(36)}`, stops }] })
        );
        router.push("/places/trip/create");
      }
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
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold text-ink">
          {count === 0 ? "בחרו מקומות" : count === 1 ? "נבחר מקום אחד" : `נבחרו ${count} מקומות`}
        </span>
        <button
          type="button"
          disabled={count === 0 || busy !== null}
          onClick={() => create("collection")}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#F1F2F5] px-3.5 text-[13.5px] font-semibold text-ink transition active:scale-95 disabled:opacity-45"
        >
          {busy === "collection" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-ink" /> : null}
          אוסף חדש
        </button>
        <button
          type="button"
          disabled={count === 0 || busy !== null}
          onClick={() => create("trip")}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold text-white transition active:scale-95 disabled:opacity-45"
          style={{ background: accent }}
        >
          {busy === "trip" ? spinner : null}
          מסלול חדש
        </button>
      </div>
      {error && <p className="px-1 pt-2 text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
