import Link from "next/link";
import type { PlaceSearchResult } from "@/services/places/searchService";
import { getCategoryLabel } from "@/utils/categoryLabels";

export function SearchResultCard({ place }: { place: PlaceSearchResult }) {
  return (
    <Link href={`/place/${place.id}`} className="flex flex-col gap-2">
      <div className="h-32 w-full overflow-hidden rounded-card bg-bg-secondary shadow-soft">
        {place.image_urls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.image_urls[0]} alt={place.name} className="h-full w-full object-cover" />
        )}
      </div>
      <div>
        <p className="truncate text-sm font-semibold text-ink">{place.name}</p>
        <div className="flex items-center justify-between">
          <p className="truncate text-xs text-ink-secondary">
            {[getCategoryLabel(place.category), place.city].filter(Boolean).join(" · ")}
          </p>
          {place.rating != null && (
            <span className="shrink-0 text-xs font-medium text-ink-secondary">
              ★ {place.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
