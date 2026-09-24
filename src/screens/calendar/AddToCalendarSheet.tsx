"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { MonthCalendar } from "./MonthCalendar";

export interface CalendarItemRef {
  itemType: "place" | "trip";
  id: string;
  name: string;
  imageUrl: string | null;
  category?: string | null;
}

export interface CalendarEntryRef {
  id: string;
  date: string;
  time: string | null;
  note: string | null;
}

const BLUE = "#0A6DFE";
const INK = { "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties;

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromIso(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** היום / מחר / שישי הקרוב / שבת הקרובה - בחירה בנגיעה אחת, בלי לפתוח לוח. */
function quickDates(): { label: string; date: Date }[] {
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const add = (n: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  const nextDow = (dow: number) => add(((dow - base.getDay() + 7) % 7) || 7);
  const list = [
    { label: "היום", date: base },
    { label: "מחר", date: add(1) },
    { label: "שישי", date: nextDow(5) },
    { label: "שבת", date: nextDow(6) },
  ];
  // בלי כפילויות (למשל ביום חמישי "מחר" = שישי)
  return list.filter((q, i) => list.findIndex((x) => toIso(x.date) === toIso(q.date)) === i);
}

function formatLong(d: Date): string {
  return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * *** חדש (בקשה מפורשת - "היומן שלי - מה להכניס ואיך להכניס"): גיליון אחד להוספה ליומן מכל מקום
 * באפליקציה (עמוד אטרקציה, הבחירות שלי, טיול של הקהילה, תוך היומן עצמו) - וגם לעריכת פריט קיים.
 * תאריך (חובה) בנגיעה: היום / מחר / שישי / שבת, או לוח חודשי. שעה והערה - אופציונליים.
 */
export function AddToCalendarSheet({
  item,
  entry,
  initialDate,
  onClose,
  onDone,
}: {
  item: CalendarItemRef;
  /** מועבר = מצב עריכה של פריט שכבר ביומן. */
  entry?: CalendarEntryRef;
  initialDate?: Date | null;
  onClose: () => void;
  /** אחרי שמירה / הסרה מוצלחת. */
  onDone: (result: { action: "added" | "updated" | "removed"; date?: string }) => void;
}) {
  const quick = useMemo(quickDates, []);
  const [date, setDate] = useState<Date | null>(entry ? fromIso(entry.date) : (initialDate ?? null));
  const [showMonth, setShowMonth] = useState(() => {
    if (!entry && !initialDate) return false;
    const d = entry ? fromIso(entry.date) : initialDate!;
    return !quick.some((q) => toIso(q.date) === toIso(d));
  });
  const [time, setTime] = useState(entry?.time ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!entry;

  async function handleSave() {
    if (!date || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/places/calendar", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { entryId: entry!.id, date: toIso(date), time: time || null, note }
            : {
                itemType: item.itemType,
                placeId: item.id,
                placeName: item.name,
                imageUrl: item.imageUrl,
                category: item.category ?? null,
                date: toIso(date),
                time: time || null,
                note,
              }
        ),
      });
      if (!res.ok) throw new Error();
      onDone({ action: isEdit ? "updated" : "added", date: toIso(date) });
    } catch {
      setError("השמירה ביומן נכשלה. בדקו את החיבור ונסו שוב.");
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!entry || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/calendar?entryId=${encodeURIComponent(entry.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDone({ action: "removed" });
    } catch {
      setError("ההסרה נכשלה. נסו שוב.");
      setSaving(false);
    }
  }

  const chip = (active: boolean) =>
    `flex h-10 items-center justify-center rounded-full px-4 text-[14px] font-semibold transition active:scale-95 ${active ? "text-white" : "bg-[#F1F2F5] text-ink"}`;

  const footer = (
    <div className="flex flex-col gap-1.5 px-5 pb-8" style={INK}>
      {error && <p className="pb-1 text-center text-[13px] font-medium text-danger">{error}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={!date || saving}
        className="h-12 w-full rounded-xl text-[15.5px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
        style={{ background: BLUE }}
      >
        {saving ? "שומרים..." : !date ? "בחרו תאריך" : isEdit ? "שמירת שינויים" : `הוספה ליומן · ${formatLong(date)}`}
      </button>
      {isEdit && (
        <button type="button" onClick={handleRemove} disabled={saving} className="h-11 w-full rounded-xl text-[14.5px] font-medium text-danger">
          הסרה מהיומן
        </button>
      )}
    </div>
  );

  const sheet = (
    <BottomSheet onClose={onClose} footer={footer}>
      <div className="flex flex-col gap-5 px-5 pb-2" style={INK}>
        <div className="flex items-center gap-3.5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F1F2F5] text-2xl">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">{item.itemType === "trip" ? "🧭" : "📍"}</span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[19px] font-bold leading-tight text-ink">{isEdit ? "עריכה ביומן" : "הוספה ליומן"}</h2>
            <p className="mt-0.5 truncate text-[14px] text-ink-secondary">{item.name}</p>
          </div>
        </div>

        <section>
          <h3 className="mb-2.5 text-[15px] font-bold text-ink">מתי?</h3>
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => {
              const active = !showMonth && !!date && toIso(date) === toIso(q.date);
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => {
                    setDate(q.date);
                    setShowMonth(false);
                  }}
                  className={chip(active)}
                  style={active ? { background: BLUE } : undefined}
                  aria-pressed={active}
                >
                  {q.label}
                </button>
              );
            })}
            <button type="button" onClick={() => setShowMonth((v) => !v)} className={chip(showMonth)} style={showMonth ? { background: BLUE } : undefined} aria-expanded={showMonth}>
              תאריך אחר
            </button>
          </div>
          {date && !showMonth && <p className="mt-2 text-[13.5px] text-ink-secondary">{formatLong(date)}</p>}
          {showMonth && (
            <div className="mt-3">
              <MonthCalendar eventDates={new Set()} selectedDate={date} onSelectDay={setDate} onMonthChange={() => {}} disablePast />
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2.5 text-[15px] font-bold text-ink">
            שעה <span className="font-normal text-ink-secondary">(לא חובה)</span>
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="שעה"
              className="h-12 min-w-0 flex-1 appearance-none rounded-xl bg-[#F1F2F5] px-4 text-[15px] text-ink focus:bg-white focus:outline-none focus:ring-[1.5px] focus:ring-[#0A6DFE]"
            />
            {time && (
              <button type="button" onClick={() => setTime("")} className="h-12 shrink-0 rounded-xl px-4 text-[14px] font-medium text-ink-secondary active:bg-black/[0.04]">
                בלי שעה
              </button>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-2.5 text-[15px] font-bold text-ink">
            הערה <span className="font-normal text-ink-secondary">(לא חובה)</span>
          </h3>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            placeholder="למשל: להזמין מקום מראש"
            className="h-12 w-full rounded-xl bg-[#F1F2F5] px-4 text-[15px] text-ink placeholder:text-ink-secondary/70 focus:bg-white focus:outline-none focus:ring-[1.5px] focus:ring-[#0A6DFE]"
          />
        </section>
      </div>
    </BottomSheet>
  );

  return typeof document === "undefined" ? sheet : createPortal(sheet, document.body);
}
