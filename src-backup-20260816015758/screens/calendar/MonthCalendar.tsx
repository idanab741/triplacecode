"use client";

import { useEffect, useMemo, useState } from "react";

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

const WEEKDAY_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

interface CalendarCell {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const today = new Date();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return {
      date,
      inCurrentMonth: date.getMonth() === month,
      isToday: isSameDay(date, today),
    };
  });
}

interface MonthCalendarProps {
  eventDates: Set<string>;
  selectedDate: Date | null;
  onSelectDay: (date: Date) => void;
  onMonthChange: (year: number, month: number) => void;
}

export function MonthCalendar({ eventDates, selectedDate, onSelectDay, onMonthChange }: MonthCalendarProps) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    onMonthChange(cursor.year, cursor.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.year, cursor.month]);

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const weeks = useMemo(() => {
    const rows: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cells]);

  function goToPrevMonth() {
    setCursor((prev) => {
      const month = prev.month === 0 ? 11 : prev.month - 1;
      const year = prev.month === 0 ? prev.year - 1 : prev.year;
      return { year, month };
    });
  }

  function goToNextMonth() {
    setCursor((prev) => {
      const month = prev.month === 11 ? 0 : prev.month + 1;
      const year = prev.month === 11 ? prev.year + 1 : prev.year;
      return { year, month };
    });
  }

  return (
    <div className="rounded-card bg-white p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={goToNextMonth}
          aria-label="לחודש הבא"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition active:scale-90"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>

        <p className="text-base font-bold text-ink">
          {HEBREW_MONTHS[cursor.month]} {cursor.year}
        </p>

        <button
          type="button"
          onClick={goToPrevMonth}
          aria-label="לחודש הקודם"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition active:scale-90"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAY_LETTERS.map((letter, i) => (
          <div key={i} className="pb-2 text-xs font-semibold text-ink-secondary">
            {letter}
          </div>
        ))}

        {weeks.map((week, weekIndex) =>
          week.map((cell) => {
            const key = dateKey(cell.date);
            const hasEvent = cell.inCurrentMonth && eventDates.has(key);
            const selected = selectedDate ? isSameDay(cell.date, selectedDate) : false;
            return (
              <button
                key={`${weekIndex}-${key}`}
                type="button"
                onClick={() => onSelectDay(cell.date)}
                className="mx-auto flex flex-col items-center gap-0.5 py-0.5"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition active:scale-90 ${
                    !cell.inCurrentMonth
                      ? "text-ink-secondary/35"
                      : cell.isToday
                        ? "bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white font-bold"
                        : selected
                          ? "border-2 border-[var(--color-primary-start)] text-ink"
                          : "text-ink"
                  }`}
                >
                  {cell.date.getDate()}
                </span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    hasEvent ? "bg-[var(--color-primary-start)]" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}