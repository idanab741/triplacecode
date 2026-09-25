"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@/screens/create/CreateUi";
import type { CollectionDetailDto } from "@/services/social/collectionTypes";
import type { TripDetailDto } from "@/services/social/tripTypes";
import { CollectionItemPickerSheet } from "./CollectionItemPickerSheet";
import { formItemFromDto, formItemKey, type CollectionFormItem } from "./collectionFormTypes";

/**
 * *** בקשה מפורשת ("להוסיף מקומות למפה / לטיול אחרי שנשמרו - רק ליוצר"): שורת "+ הוספת מקום" בסוף
 * הרשימה בעמוד המפה / הטיול. פותחת את אותו חלון בחירה כמו ביצירה, וכל פריט נשמר מיד (בלי טופס עריכה).
 * מוצג רק ליוצר; ההוספה נאכפת גם בשרת (רק היוצר) - ר' /api/social/collections/[id]/items ו-trips/[id]/stops.
 */
function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-[#D5D9E0] text-[15px] font-semibold text-[#0A6DFE] transition active:scale-[0.99] active:bg-[#F4F7FF]"
    >
      <PlusIcon size={19} />
      {label}
    </button>
  );
}

/** כפתור קטן בכותרת הרשימה - גלוי מיד כשנכנסים למפה / לטיול, בלי לגלול לסוף */
function HeaderButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#0A6DFE] px-3.5 text-[13.5px] font-semibold text-white transition active:scale-95"
    >
      <PlusIcon size={16} />
      הוספה
    </button>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p className="mt-2 text-center text-[13px] text-[#C8373C]" role="alert">
      {message}
    </p>
  ) : null;
}

async function post(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "ההוספה נכשלה, נסו שוב");
  }
}

/** מפה (אוסף): מקומות או טיולים, לפי סוג המפה. */
export function CollectionQuickAdd({
  collection,
  onChanged,
  variant = "row",
}: {
  collection: CollectionDetailDto;
  onChanged: () => void;
  /** row = שורה מקווקוות בסוף הרשימה; header = כפתור "+ הוספה" בכותרת */
  variant?: "row" | "header";
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const addedKeys = useMemo(
    () => new Set([...collection.items.map((item) => formItemFromDto(item).key), ...pending]),
    [collection.items, pending]
  );

  if (!collection.viewerState.isSelf) return null;

  async function handleAdd(item: CollectionFormItem) {
    if (addedKeys.has(item.key)) return;
    setError(null);
    setPending((p) => [...p, item.key]);
    try {
      await post(
        `/api/social/collections/${collection.id}/items`,
        item.kind === "place" ? { placeIds: [item.refId] } : { trips: [{ id: item.refId, source: item.tripSource }] }
      );
      onChanged();
    } catch (e) {
      setPending((p) => p.filter((k) => k !== item.key));
      setError(e instanceof Error ? e.message : "ההוספה נכשלה, נסו שוב");
    }
  }

  const addLabel = collection.type === "places" ? "הוספת מקום" : "הוספת טיול";
  return (
    <div className={variant === "row" ? "mt-6" : "contents"}>
      {variant === "row" ? <AddRow label={addLabel} onClick={() => setOpen(true)} /> : <HeaderButton label={`${addLabel} למפה`} onClick={() => setOpen(true)} />}
      {variant === "row" && <ErrorLine message={open ? null : error} />}
      {open && (
        <CollectionItemPickerSheet
          type={collection.type}
          addedKeys={addedKeys}
          onAdd={handleAdd}
          onClose={() => setOpen(false)}
          heading={collection.type === "places" ? "הוספת מקום למפה" : "הוספת טיול למפה"}
        />
      )}
      {open && error && (
        <div className="fixed inset-x-4 bottom-6 z-[80] mx-auto max-w-md rounded-2xl bg-[#C8373C] px-4 py-3 text-center text-[14px] font-semibold text-white" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

/** טיול: תחנה חדשה בסוף יום מסוים (day), או בסוף הטיול. */
export function TripQuickAdd({
  trip,
  day,
  label,
  onChanged,
  variant = "row",
}: {
  trip: TripDetailDto;
  day: number;
  label: string;
  onChanged: () => void;
  variant?: "row" | "header";
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const addedKeys = useMemo(
    () => new Set([...trip.stops.map((s) => formItemKey("place", s.place.id)), ...pending]),
    [trip.stops, pending]
  );

  if (!trip.viewerState.isSelf) return null;

  async function handleAdd(item: CollectionFormItem) {
    if (item.kind !== "place" || addedKeys.has(item.key)) return;
    setError(null);
    setPending((p) => [...p, item.key]);
    try {
      await post(`/api/social/trips/${trip.id}/stops`, { placeIds: [item.refId], day });
      onChanged();
    } catch (e) {
      setPending((p) => p.filter((k) => k !== item.key));
      setError(e instanceof Error ? e.message : "ההוספה נכשלה, נסו שוב");
    }
  }

  return (
    <div className={variant === "row" ? "mt-3" : "contents"}>
      {variant === "row" ? <AddRow label={label} onClick={() => setOpen(true)} /> : <HeaderButton label={label} onClick={() => setOpen(true)} />}
      {variant === "row" && <ErrorLine message={open ? null : error} />}
      {open && (
        <CollectionItemPickerSheet
          type="places"
          addedKeys={addedKeys}
          onAdd={handleAdd}
          onClose={() => setOpen(false)}
          heading={label}
          placeholder="חפשו מקום להוסיף לטיול"
        />
      )}
      {open && error && (
        <div className="fixed inset-x-4 bottom-6 z-[80] mx-auto max-w-md rounded-2xl bg-[#C8373C] px-4 py-3 text-center text-[14px] font-semibold text-white" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
