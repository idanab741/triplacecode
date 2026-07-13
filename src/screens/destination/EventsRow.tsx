import type { UpcomingEvent } from "@/services/events/ticketmasterService";

interface EventsRowProps {
  events: UpcomingEvent[];
}

function formatEventDate(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

/** אירועים אמיתיים שקורים באזור היעד במהלך השבוע הקרוב. */
export function EventsRow({ events }: EventsRowProps) {
  if (events.length === 0) return null;

  return (
    <div className="px-6">
      <h3 className="mb-3 text-lg font-semibold text-ink">קורה השבוע</h3>
      <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {events.map((event) => (
          <a
            key={event.id}
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-44 shrink-0"
          >
            <div className="h-28 w-44 overflow-hidden rounded-card bg-bg-secondary shadow-soft">
              {event.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={event.imageUrl} alt={event.name} className="h-full w-full object-cover" />
              )}
            </div>
            <p className="mt-1.5 truncate text-sm font-medium text-ink">{event.name}</p>
            <p className="truncate text-xs text-ink-secondary">
              {[formatEventDate(event.date), event.venueName].filter(Boolean).join(" · ")}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
