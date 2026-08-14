import Link from "next/link";
import type { PlaceSummary } from "@/services/places/placesServerService";

interface PlaceRowProps {
  title: string;
  places: PlaceSummary[];
  emptyMessage: string;
}

export function PlaceRow({ title, places, emptyMessage }: PlaceRowProps) {
  return (
    <div className="px-6">
      <h3 className="mb-3 text-lg font-semibold text-ink">{title}</h3>

      {places.length === 0 ? (
        <div className="rounded-card bg-bg-secondary px-4 py-6 text-center text-sm text-ink-secondary">
          {emptyMessage}
        </div>
      ) : (
        <div className="-mx-6 overflow-x-auto ps-6 pb-1" style={{ scrollbarWidth: "none" }}>
          <div className="flex gap-4">
            {places.map((place) => (
              <Link key={place.id} href={`/place/${place.id}`} className="w-40 shrink-0">
                <div className="h-28 w-40 overflow-hidden rounded-card bg-bg-secondary shadow-soft">
                  {place.image_urls[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={place.image_urls[0]}
                      alt={place.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <p className="mt-1.5 truncate text-sm font-medium text-ink">{place.name}</p>
                {place.rating != null && (
                  <p className="text-xs text-ink-secondary">★ {place.rating.toFixed(1)}</p>
                )}
              </Link>
            ))}
            {/* spacer סוף הרשימה - ראו הערה ב-WeatherRow. */}
            <div className="w-2 shrink-0" aria-hidden />
          </div>
        </div>
      )}
    </div>
  );
}
