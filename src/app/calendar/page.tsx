"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Screen, Skeleton } from "@/components/ui";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { MainBottomNav } from "@/components/MainBottomNav";
import { MonthCalendar } from "@/screens/calendar/MonthCalendar";
import { AddToCalendarSheet, type CalendarEntryRef, type CalendarItemRef } from "@/screens/calendar/AddToCalendarSheet";
import { useAuth } from "@/hooks/useAuth";
import { getSavedPlaceItems } from "@/services/favorites/favoritesService";
import { TRIP_TYPE_SHORT_LABEL, tripTypeIconSrc, tripTypeOfItem } from "@/constants/tripTypeOfItem";

/**
 * *** בנוי מחדש (בקשה מפורשת - "לסדר את היומן גם עיצובית וגם רעיונית - מה להכניס ואיך"):
 *  - הרעיון: "שמור" = בלי תאריך (הבחירות שלי); "יומן" = עם תאריך. כל פריט ביומן הוא מקום/אטרקציה
 *    או טיול, עם שעה והערה אופציונליות.
 *  - איך מכניסים: כפתור "ליומן" בעמוד כל אטרקציה, בעמוד טיול, בכל פריט ב"הבחירות שלי" - או "הוספה"
 *    כאן, שפותח את השמורים שלכם לבחירה.
 *  - תצוגה: לוח חודשי עם נקודות, ומתחתיו "הקרוב אליכם" (היום / מחר / השבוע / בהמשך). לחיצה על יום
 *    בלוח מציגה רק אותו.
 */

const BLUE = "#0A6DFE";
const INK = { "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties;

interface CalendarEvent {
  kind: "entry" | "session";
  id: string;
  itemType: "place" | "trip" | "session";
  refId: string;
  title: string;
  date: string;
  time: string | null;
  note: string | null;
  imageUrl: string | null;
  category: string | null;
  tripType: string | null;
  href: string;
}

interface PickOption extends CalendarItemRef {
  subtitle: string;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayDiff(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}

function longDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
}

function groupLabel(diff: number): string {
  if (diff === 0) return "היום";
  if (diff === 1) return "מחר";
  if (diff < 7) return "השבוע";
  if (diff < 31) return "החודש הקרוב";
  return "בהמשך";
}

const PlusIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

function EventRow({ event, onOpen, onEdit }: { event: CalendarEvent; onOpen: () => void; onEdit?: () => void }) {
  const typeId = event.itemType === "session" ? tripTypeOfItem(event.tripType) : tripTypeOfItem(event.category);
  const kindLabel = event.itemType === "place" ? TRIP_TYPE_SHORT_LABEL[typeId] : event.itemType === "trip" ? "טיול" : "מסלול שבניתי";
  return (
    <div className="flex items-stretch gap-3">
      <div className="w-12 shrink-0 pt-3 text-center">
        <span className={`text-[14px] font-bold tabular-nums ${event.time ? "text-ink" : "text-ink-secondary"}`}>{event.time ?? "כל היום"}</span>
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl bg-[#F4F5F7] p-2.5 transition active:scale-[0.99] active:bg-[#ECEEF2]"
      >
        <span className="relative shrink-0">
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white text-ink-secondary">
            {event.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tripTypeIconSrc(typeId)} alt="" className="h-full w-full scale-125 object-cover" />
            )}
          </span>
          {event.imageUrl && (
            <span className="absolute -bottom-1 -start-1 block h-6 w-6 overflow-hidden rounded-full bg-white ring-2 ring-[#F4F5F7]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tripTypeIconSrc(typeId)} alt="" className="h-full w-full scale-125 object-cover" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-semibold text-ink">{event.title}</span>
          <span className="block truncate text-[13px] text-ink-secondary">{event.note ? `${kindLabel} · ${event.note}` : kindLabel}</span>
        </span>
        {onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label={`עריכת ${event.title} ביומן`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-secondary transition active:bg-black/[0.06]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.9" />
              <circle cx="12" cy="12" r="1.9" />
              <circle cx="19" cy="12" r="1.9" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/** "הוספה" מתוך היומן: בוחרים מתוך המקומות והטיולים השמורים, או עוברים לחיפוש מקום חדש. */
function PickFromSavedSheet({ onClose, onPick, onSearch }: { onClose: () => void; onPick: (item: CalendarItemRef) => void; onSearch: () => void }) {
  const { user } = useAuth();
  const [options, setOptions] = useState<PickOption[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getSavedPlaceItems(user.id).catch(() => []),
      fetch("/api/me/saved")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .catch(() => ({ items: [] })),
    ]).then(([places, social]) => {
      const placeOptions: PickOption[] = places
        .filter((p) => p.place.type !== "destination")
        .map((p) => ({
          itemType: "place" as const,
          id: p.place.id,
          name: p.place.name,
          imageUrl: p.place.imageUrls[0] ?? null,
          category: p.place.category ?? p.place.subcategory,
          subtitle: [TRIP_TYPE_SHORT_LABEL[tripTypeOfItem(p.place.category, p.place.subcategory)], p.place.city].filter(Boolean).join(" · "),
        }));
      const tripOptions: PickOption[] = ((social.items ?? []) as { kind: string; id: string; title: string; imageUrl: string | null; tripType: string | null; subtitle: string | null }[])
        .filter((s) => s.kind === "trip")
        .map((s) => ({ itemType: "trip" as const, id: s.id, name: s.title, imageUrl: s.imageUrl, category: s.tripType, subtitle: `טיול · ${s.subtitle ?? ""}` }));
      setOptions([...placeOptions, ...tripOptions]);
    });
  }, [user]);

  const term = query.trim();
  const visible = (options ?? []).filter((o) => !term || o.name.includes(term));

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex flex-col gap-4 px-5 pb-8" style={INK}>
        <div>
          <h2 className="text-[19px] font-bold text-ink">מה מכניסים ליומן?</h2>
          <p className="mt-0.5 text-[14px] text-ink-secondary">בחרו מהמקומות והטיולים ששמרתם</p>
        </div>

        <label className="flex h-12 items-center gap-2.5 rounded-xl bg-[#F1F2F5] px-4 focus-within:bg-white focus-within:ring-[1.5px] focus-within:ring-[#0A6DFE]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-ink-secondary" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש בשמורים" className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-secondary focus:outline-none" />
        </label>

        {options === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-[14.5px] leading-relaxed text-ink-secondary">
            {term ? "לא נמצא בשמורים." : "עוד אין לכם מקומות שמורים. חפשו מקום, או לחצו ליומן בעמוד של כל אטרקציה."}
          </p>
        ) : (
          <ul className="-mx-2 flex max-h-[44vh] flex-col overflow-y-auto overscroll-contain">
            {visible.map((o) => (
              <li key={`${o.itemType}:${o.id}`}>
                <button type="button" onClick={() => onPick(o)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start transition-colors active:bg-black/[0.04]">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F1F2F5]">
                    {o.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tripTypeIconSrc(tripTypeOfItem(o.category))} alt="" className="h-full w-full scale-125 object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{o.name}</span>
                    <span className="block truncate text-[13px] text-ink-secondary">{o.subtitle}</span>
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: BLUE }}>
                    {PlusIcon}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button type="button" onClick={onSearch} className="h-12 w-full rounded-xl bg-[#EFF1F4] text-[15.5px] font-semibold text-ink transition active:scale-[0.98]">
          חיפוש מקום חדש
        </button>
      </div>
    </BottomSheet>
  );
}

function HowItWorks({ onAdd }: { onAdd: () => void }) {
  const steps: { icon: ReactNode; text: string }[] = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
      ),
      text: "מוצאים בית קפה, אטרקציה או טיול בטבע",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      ),
      text: "לוחצים ליומן בעמוד שלו",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      ),
      text: "בוחרים יום, ואם רוצים גם שעה והערה",
    },
  ];
  return (
    <div className="rounded-2xl bg-[#F4F5F7] p-4">
      <p className="text-[16px] font-bold text-ink">היומן שלכם עוד ריק</p>
      <ol className="mt-3 flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink">{s.icon}</span>
            <span className="text-[14.5px] leading-snug text-ink">{s.text}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15.5px] font-semibold text-white transition active:scale-[0.98]"
        style={{ background: BLUE }}
      >
        {PlusIcon}
        הוספה מהשמורים
      </button>
    </div>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const [monthEvents, setMonthEvents] = useState<CalendarEvent[]>([]);
  const [upcoming, setUpcoming] = useState<CalendarEvent[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [adding, setAdding] = useState<CalendarItemRef | null>(null);
  const [editing, setEditing] = useState<{ item: CalendarItemRef; entry: CalendarEntryRef } | null>(null);
  const monthRef = useRef<{ year: number; month: number } | null>(null);

  const loadMonth = useCallback((year: number, month: number) => {
    monthRef.current = { year, month };
    fetch(`/api/calendar/events?year=${year}&month=${month + 1}`)
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((data) => setMonthEvents(data.events ?? []))
      .catch(() => setMonthEvents([]));
  }, []);

  const loadUpcoming = useCallback(() => {
    fetch("/api/calendar/events?upcoming=1")
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((data) => setUpcoming(data.events ?? []))
      .catch(() => setUpcoming([]));
  }, []);

  useEffect(() => {
    loadUpcoming();
  }, [loadUpcoming]);

  function refresh() {
    loadUpcoming();
    if (monthRef.current) loadMonth(monthRef.current.year, monthRef.current.month);
  }

  const eventDates = useMemo(() => new Set(monthEvents.map((e) => e.date)), [monthEvents]);
  const selectedIso = selectedDate ? toIso(selectedDate) : null;
  const dayEvents = selectedIso ? monthEvents.filter((e) => e.date === selectedIso) : [];

  const groups = useMemo(() => {
    const out: { label: string; days: { date: string; events: CalendarEvent[] }[] }[] = [];
    for (const e of upcoming ?? []) {
      const label = groupLabel(dayDiff(e.date));
      let g = out.find((x) => x.label === label);
      if (!g) out.push((g = { label, days: [] }));
      let day = g.days.find((d) => d.date === e.date);
      if (!day) g.days.push((day = { date: e.date, events: [] }));
      day.events.push(e);
    }
    return out;
  }, [upcoming]);

  function openEvent(e: CalendarEvent) {
    router.push(e.href);
  }

  function editEvent(e: CalendarEvent) {
    if (e.kind !== "entry") return;
    setEditing({
      item: { itemType: e.itemType === "trip" ? "trip" : "place", id: e.refId, name: e.title, imageUrl: e.imageUrl, category: e.category },
      entry: { id: e.id, date: e.date, time: e.time, note: e.note },
    });
  }

  const renderEvent = (e: CalendarEvent) => (
    <EventRow key={`${e.kind}:${e.id}`} event={e} onOpen={() => openEvent(e)} onEdit={e.kind === "entry" ? () => editEvent(e) : undefined} />
  );

  return (
    <Screen withBottomNavSpacing className="!bg-white !px-0 !pt-0">
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => router.push("/profile")} />

      <div className="mx-auto flex max-w-xl flex-col pb-6" style={INK}>
        <header className="flex items-end justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">היומן שלי</h1>
            <p className="mt-1 text-[14px] text-ink-secondary">מה מתוכנן לכם, ומתי</p>
          </div>
          <button
            type="button"
            onClick={() => setPickOpen(true)}
            className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl px-4 text-[15.5px] font-semibold text-white transition active:scale-[0.98]"
            style={{ background: BLUE }}
          >
            {PlusIcon}
            הוספה
          </button>
        </header>

        <div className="px-5 pt-4">
          <MonthCalendar
            eventDates={eventDates}
            selectedDate={selectedDate}
            onSelectDay={(d) => setSelectedDate((prev) => (prev && toIso(prev) === toIso(d) ? null : d))}
            onMonthChange={loadMonth}
          />
        </div>

        {selectedIso ? (
          <section className="px-5 pt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-bold text-ink">{longDay(selectedIso)}</h2>
              <button type="button" onClick={() => setSelectedDate(null)} className="h-10 shrink-0 rounded-lg px-2 text-[14px] font-semibold" style={{ color: BLUE }}>
                הכל
              </button>
            </div>
            {dayEvents.length === 0 ? (
              <p className="rounded-2xl bg-[#F4F5F7] px-4 py-4 text-[14.5px] text-ink-secondary">אין כלום ביום הזה עדיין.</p>
            ) : (
              <div className="flex flex-col gap-2.5">{dayEvents.map(renderEvent)}</div>
            )}
            {(dayDiff(selectedIso) >= 0) && (
              <button
                type="button"
                onClick={() => setPickOpen(true)}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#EFF1F4] text-[15.5px] font-semibold text-ink transition active:scale-[0.98]"
              >
                {PlusIcon}
                הוספה ליום הזה
              </button>
            )}
          </section>
        ) : (
          <section className="px-5 pt-6">
            <h2 className="mb-3 text-[17px] font-bold text-ink">הקרוב אליכם</h2>
            {upcoming === null ? (
              <div className="flex flex-col gap-2.5">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-[76px] w-full rounded-2xl" />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <HowItWorks onAdd={() => setPickOpen(true)} />
            ) : (
              <div className="flex flex-col gap-5">
                {groups.map((g) => (
                  <div key={g.label}>
                    <p className="mb-2 text-[13px] font-bold" style={{ color: BLUE }}>
                      {g.label}
                    </p>
                    <div className="flex flex-col gap-4">
                      {g.days.map((day) => (
                        <div key={day.date}>
                          {g.label !== "היום" && g.label !== "מחר" && <p className="mb-1.5 text-[14px] font-semibold text-ink">{longDay(day.date)}</p>}
                          <div className="flex flex-col gap-2.5">{day.events.map(renderEvent)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {pickOpen && (
        <PickFromSavedSheet
          onClose={() => setPickOpen(false)}
          onSearch={() => router.push("/search")}
          onPick={(item) => {
            setPickOpen(false);
            setAdding(item);
          }}
        />
      )}

      {adding && (
        <AddToCalendarSheet
          item={adding}
          initialDate={selectedDate && dayDiff(toIso(selectedDate)) >= 0 ? selectedDate : null}
          onClose={() => setAdding(null)}
          onDone={() => {
            setAdding(null);
            refresh();
          }}
        />
      )}

      {editing && (
        <AddToCalendarSheet
          item={editing.item}
          entry={editing.entry}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      <MainBottomNav active="profile" />
    </Screen>
  );
}
