import Link from "next/link";
import { formatTripMeta, type TripCardDto } from "@/services/social/tripTypes";
import { CollectionCover } from "@/screens/collections/CollectionCover";
import { tripPath } from "./TripFeedCard";

/** כרטיס Trip ב-Grid של טאב "טיולים" בפרופיל: Cover, שם הטיול, "5 תחנות · 2 ימים". */
export function TripAlbumCard({ item }: { item: TripCardDto }) {
  return (
    <Link href={tripPath(item.id)} className="flex flex-col gap-1.5">
      <div className="overflow-hidden rounded-card shadow-soft">
        <CollectionCover coverUrl={item.coverUrl ?? item.autoCoverUrl} collageUrls={[]} type="trips" className="aspect-square" />
      </div>
      <div className="px-0.5">
        <p className="line-clamp-1 text-[14px] font-bold text-ink">{item.title}</p>
        <p className="text-[12px] text-ink-secondary">
          {formatTripMeta(item.stopCount, item.dayCount)}
          {item.visibility === "private" ? " · פרטי" : ""}
        </p>
      </div>
    </Link>
  );
}
