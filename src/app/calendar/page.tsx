"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Screen } from "@/components/ui";
import { SimpleAppHeader } from "@/screens/layout/SimpleAppHeader";
import { MainBottomNav } from "@/components/MainBottomNav";
import { MonthCalendar } from "@/screens/calendar/MonthCalendar";

interface CalendarEvent {
  sessionId: string;
  tripType: string;
  destinationLabel: string;
  calendarDate: string;
  imageUrl: string | null;
}

const TRIP_TYPE_ROUTE: Record<string, string> = {
  abroad_vacation: "abroad-vacation",
  day_trip: "day-trip",
  romantic_date: "romantic-date",
  nightlife: "nightlife",
};

function tripResultPath(tripType: string, sessionId: string): string {
  const routeSegment = TRIP_TYPE_ROUTE[tripType] ?? tripType.replace(/_/g, "-");
  return `/trip-builder/${routeSegment}/result?sessionId=${sessionId}`;
}

function dateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
}

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  function handleMonthChange(year: number, month: number) {
    fetch(`/api/calendar/events?year=${year}&month=${month + 1}`)
      .then((res) => res.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]));
  }

  const eventDates = new Set(events.map((e) => e.calendarDate));
  const selectedDayEvents = selectedDate ? events.filter((e) => e.calendarDate === dateKey(selectedDate)) : [];

  return (
    <Screen withBottomNavSpacing className="!bg-bg !px-0 !pt-0">
      <SimpleAppHeader onBack={() => router.push("/profile")} title="היומן שלי" />

      <div className="overflow-hidden rounded-b-[40px] bg-white">
        <Image
          src="/images/hero-calendar.png"
          alt="היומן שלי"
          width={800}
          height={360}
          priority
          className="h-auto w-full"
        />
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-5">
        <MonthCalendar
          eventDates={eventDates}
          selectedDate={selectedDate}
          onSelectDay={setSelectedDate}
          onMonthChange={handleMonthChange}
        />

        {selectedDate && (
          <div className="rounded-card bg-white p-4 shadow-soft">
            <p className="mb-3 text-sm font-bold text-ink">{formatDayLabel(selectedDate)}</p>

            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-ink-secondary">אין טיולים ביום זה</p>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedDayEvents.map((event) => (
                  <button
                    key={event.sessionId}
                    type="button"
                    onClick={() => router.push(tripResultPath(event.tripType, event.sessionId))}
                    className="flex items-center gap-3 rounded-card bg-bg px-3 py-2.5 text-right transition active:scale-[0.98]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-lg shadow-soft">
                      {event.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={event.imageUrl} alt={event.destinationLabel} className="h-full w-full object-cover" />
                      ) : (
                        "🧳"
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {event.destinationLabel}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <MainBottomNav active="profile" />
    </Screen>
  );
}