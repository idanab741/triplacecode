export interface Destination {
  id: string;
  name: string;
  imageUrl: string;
}

interface HotDestinationsProps {
  destinations: Destination[];
}

/** מקטע "יעדים חמים": מצב ריק מעוצב עד שיהיו נתונים אמיתיים. */
export function HotDestinations({ destinations }: HotDestinationsProps) {
  return (
    <div className="px-6">
      <h3 className="mb-3 text-lg font-semibold text-ink">יעדים חמים</h3>

      {destinations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-card bg-bg-secondary px-6 py-10 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-secondary)" strokeWidth="1.5">
            <path d="M12 22s7-6.5 7-12A7 7 0 0 0 5 10c0 5.5 7 12 7 12Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <p className="text-sm font-medium text-ink">יעדים חמים בדרך אליכם!</p>
          <p className="text-xs text-ink-secondary">בקרוב נציג כאן המלצות מותאמות אישית</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {destinations.map((destination) => (
            <div
              key={destination.id}
              className="relative h-40 w-56 shrink-0 overflow-hidden rounded-card shadow-soft"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={destination.imageUrl}
                alt={destination.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.55),transparent)] p-3">
                <p className="font-semibold text-white">{destination.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
