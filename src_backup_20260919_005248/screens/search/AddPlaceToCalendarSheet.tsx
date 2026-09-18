"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { MonthCalendar } from "@/screens/calendar/MonthCalendar";

interface AddPlaceToCalendarSheetProps {
  placeId: string;
  placeName: string;
  imageUrl: string | null;
  onClose: () => void;
  /** נקרא אחרי הוספה מוצלחת - העמוד הקורא אחראי לנווט לעמוד הבית. */
  onAdded: () => void;
}

function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** פופאפ עם ה-HERO של המקום ולשונית תאריך - לבחירת התאריך שאליו מתווסף
 *  המקום ביומן, כשאין (כמו בצ'אט של בניית מסלול) תאריך שכבר הוזן. */
export function AddPlaceToCalendarSheet({
  placeId,
  placeName,
  imageUrl,
  onClose,
  onAdded,
}: AddPlaceToCalendarSheetProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!selectedDate || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/places/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId,
          placeName,
          imageUrl,
          date: toIsoDate(selectedDate),
        }),
      });
      if (!response.ok) throw new Error();
      onAdded();
    } catch {
      setError("ההוספה ליומן נכשלה, נסו שוב");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex flex-col gap-4 px-5 pb-4">
        <div className="relative h-40 w-full overflow-hidden rounded-card bg-bg-secondary">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={placeName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl">📍</div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-bold text-ink">הוספה ליומן</h2>
          <p className="mt-0.5 text-sm text-ink-secondary">{placeName}</p>
        </div>

        <MonthCalendar
          eventDates={new Set()}
          selectedDate={selectedDate}
          onSelectDay={setSelectedDate}
          onMonthChange={() => {}}
        />

        {error && <p className="text-center text-sm text-danger">{error}</p>}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedDate || saving}
          className="w-full rounded-pill py-3 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          {saving ? "מוסיף..." : "אישור והוספה ליומן"}
        </button>
      </div>
    </BottomSheet>
  );
}
