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
  /** בחירת תאריך להוספה - ימים שעברו לא לחיצים. */
  disablePast?: boolean;
  /** בלי מסגרת/רקע משלו - כשהוא יושב בתוך גיליון. */
  bare?: boolean;
}

const BLUE = "#0A6DFE";

function Arrow({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "next" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/**
 * *** שדרוג עיצובי (בקשה מפורשת - "לסדר את היומן גם עיצובית"): קו העיצוב החדש - בלי צל וכרטיס, כחול
 * מלא לסימון (היום = עיגול כחול מלא, נבחר = טבעת כחולה), נקודה כחולה מתחת לימים שיש בהם משהו ביומן.
 */
export function MonthCalendar({ eventDates, selectedDate, onSelectDay, onMonthChange, disablePast = false, bare = false }: MonthCalendarProps) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    onMonthChange(cursor.year, cursor.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.year, cursor.month]);

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const todayStart = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  function shift(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const isCurrentMonth = cursor.year === todayStart.getFullYear() && cursor.month === todayStart.getMonth();

  return (
    <div className={bare ? "" : "rounded-2xl bg-[#F7F8FA] p-3.5"}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={disablePast && isCurrentMonth}
          aria-label="לחודש הקודם"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition active:bg-black/[0.05] disabled:opacity-25"
        >
          <Arrow dir="prev" />
        </button>
        <p className="text-[16px] font-bold text-ink">
          {HEBREW_MONTHS[cursor.month]} {cursor.year}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="לחודש הבא"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition active:bg-black/[0.05]"
        >
          <Arrow dir="next" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAY_LETTERS.map((letter, i) => (
          <div key={i} className="pb-1.5 text-[12px] font-semibold text-ink-secondary">
            {letter}
          </div>
        ))}

        {cells.map((cell) => {
          const key = dateKey(cell.date);
          const hasEvent = cell.inCurrentMonth && eventDates.has(key);
          const selected = selectedDate ? isSameDay(cell.date, selectedDate) : false;
          const past = disablePast && cell.date < todayStart;
          const muted = !cell.inCurrentMonth || past;
          return (
            <button
              key={key}
              type="button"
              disabled={past}
              onClick={() => onSelectDay(cell.date)}
              aria-pressed={selected}
              aria-label={cell.date.toLocaleDateString("he-IL", { day: "numeric", month: "long" })}
              className="mx-auto flex flex-col items-center gap-0.5 py-0.5 disabled:cursor-default"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full text-[15px] tabular-nums transition active:scale-90 ${
                  muted ? "text-ink-secondary/35" : cell.isToday ? "font-bold text-white" : selected ? "font-bold text-ink" : "font-medium text-ink"
                }`}
                style={
                  !muted && cell.isToday
                    ? { background: BLUE, boxShadow: selected ? `0 0 0 2px #fff, 0 0 0 4px ${BLUE}` : undefined }
                    : !muted && selected
                      ? { boxShadow: `inset 0 0 0 2px ${BLUE}` }
                      : undefined
                }
              >
                {cell.date.getDate()}
              </span>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: hasEvent ? BLUE : "transparent" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
