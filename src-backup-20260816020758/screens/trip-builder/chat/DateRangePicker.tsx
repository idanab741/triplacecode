"use client";

import { useState } from "react";
import Image from "next/image";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
}

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
const HEBREW_WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = startDate ? new Date(startDate) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  function daysInMonth(view: Date): (Date | null)[] {
    const year = view.getFullYear();
    const month = view.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
    return cells;
  }

  function handleDayClick(day: Date) {
    const iso = toISODate(day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (day < today) return; // לא ניתן לבחור תאריך שעבר

    if (!tempStart || (tempStart && tempEnd)) {
      // התחלת בחירה חדשה
      setTempStart(iso);
      setTempEnd("");
    } else if (iso < tempStart) {
      // נלחץ תאריך מוקדם מההתחלה - הופך להיות ההתחלה החדשה
      setTempStart(iso);
      setTempEnd("");
    } else {
      setTempEnd(iso);
      onChange(tempStart, iso);
      setOpen(false);
    }
  }

  function isInRange(day: Date): boolean {
    if (!tempStart) return false;
    const iso = toISODate(day);
    const end = tempEnd || tempStart;
    return iso >= tempStart && iso <= end;
  }

  function isEdge(day: Date): boolean {
    const iso = toISODate(day);
    return iso === tempStart || iso === tempEnd;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-3 rounded-pill border border-ink-secondary/25 bg-white px-4 py-3 text-sm"
      >
        <span className="relative h-5 w-5 shrink-0">
          <Image src="/icons/calendar.png" alt="" fill className="object-contain" />
        </span>
        <span className="text-ink">
          {startDate ? formatDisplay(startDate) : "תאריך יציאה"}
        </span>
        <span className="text-ink-secondary">←</span>
        <span className="text-ink">
          {endDate ? formatDisplay(endDate) : "תאריך חזרה"}
        </span>
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 rounded-card bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="rounded-full p-1.5 text-ink-secondary hover:bg-bg-secondary"
            >
              ›
            </button>
            <p className="text-sm font-semibold text-ink">
              {HEBREW_MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="rounded-full p-1.5 text-ink-secondary hover:bg-bg-secondary"
            >
              ‹
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-secondary">
            {HEBREW_WEEKDAYS.map((w) => (
              <span key={w} className="py-1">{w}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {daysInMonth(viewMonth).map((day, i) =>
              day ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`aspect-square rounded-full text-sm transition ${
                    isEdge(day)
                      ? "bg-accent text-white font-semibold"
                      : isInRange(day)
                      ? "bg-accent/15 text-ink"
                      : "text-ink hover:bg-bg-secondary"
                  }`}
                >
                  {day.getDate()}
                </button>
              ) : (
                <span key={i} />
              )
            )}
          </div>

          <p className="mt-3 text-center text-xs text-ink-secondary">
            {!tempStart ? "בחרו תאריך יציאה" : !tempEnd ? "עכשיו בחרו תאריך חזרה" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
