"use client";

import { useEffect, useState } from "react";
import { AttractionInfoRow } from "./AttractionInfoGroup";
import { ClockIcon, ChevronIcon } from "./icons";
import { parseOpeningHoursForDay, isPlaceOpenNow } from "@/utils/openingHours";

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** השורה של היום מתוך שורות Google ("יום שני: 08:00–21:00"). "שני" נבדק כמילה שלמה אחרי "יום". */
function lineForDay(hours: string[], day: number): string | null {
  const name = DAYS[day];
  return hours.find((h) => new RegExp(`(^|יום\\s)${name}(\\s|:|$)`).test(h)) ?? null;
}

function hoursPart(line: string): string {
  return line.includes(":") ? line.slice(line.indexOf(":") + 1).trim() : line;
}

/**
 * שעות פעילות + "פתוח עכשיו / סגור עכשיו". מחושב אצל המשתמש (שעון המכשיר) ולא בשרת - השרת רץ
 * ב-UTC ו"פתוח/סגור" היה יוצא שגוי. לחיצה פותחת את כל השבוע, עם היום הנוכחי מודגש.
 */
export function AttractionHoursRow({ hours }: { hours: string[] }) {
  const [now, setNow] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => setNow(new Date()), []);

  const today = now ? now.getDay() : null;
  const todayLine = today != null ? lineForDay(hours, today) : null;
  const is24h = !!todayLine && /24/.test(todayLine) && /שעות/.test(todayLine);
  const openNow = is24h ? true : now ? isPlaceOpenNow(hours) : null;
  const parsed = today != null ? parseOpeningHoursForDay(hours, today) : null;

  return (
    <AttractionInfoRow icon={<ClockIcon />}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 text-start">
        <span className="min-w-0 flex-1">
          {openNow != null ? (
            <span className={`font-semibold ${openNow ? "text-[#0F9D58]" : "text-[#D93025]"}`}>{openNow ? "פתוח עכשיו" : "סגור עכשיו"}</span>
          ) : (
            <span className="font-semibold">שעות פעילות</span>
          )}
          {todayLine && (
            <span className="text-ink-secondary">
              {" · "}
              {parsed === "closed" ? "סגור היום" : `היום ${hoursPart(todayLine)}`}
            </span>
          )}
        </span>
        <span className="shrink-0 text-ink-secondary">
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {DAYS.map((name, i) => {
            const line = lineForDay(hours, i);
            if (!line) return null;
            const isToday = i === today;
            return (
              <li key={name} className={`flex justify-between gap-4 text-[14px] ${isToday ? "font-semibold text-ink" : "text-ink-secondary"}`}>
                <span>יום {name}</span>
                <span dir="ltr">{hoursPart(line)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </AttractionInfoRow>
  );
}
