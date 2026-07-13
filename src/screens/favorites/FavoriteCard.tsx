import Link from "next/link";
import type { UnifiedPlace } from "@/services/places/unifiedPlaceService";

export function FavoriteCard({ place }: { place: UnifiedPlace }) {
  const subtitle = [place.subcategory, place.category, place.country].filter(Boolean)[0];

  return (
    <Link href={`/place/${place.id}`} className="flex flex-col gap-2">
      <div className="relative h-32 w-full overflow-hidden rounded-card bg-bg-secondary shadow-soft">
        {place.imageUrls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.imageUrls[0]} alt={place.name} className="h-full w-full object-cover" />
        )}
      </div>
      <div>
        <p className="truncate text-sm font-semibold text-ink">{place.name}</p>
        <div className="flex items-center justify-between">
          {subtitle && <p className="truncate text-xs text-ink-secondary">{subtitle}</p>}
          {place.rating != null && (
            <span className="shrink-0 text-xs font-medium text-ink-secondary">★ {place.rating.toFixed(1)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
