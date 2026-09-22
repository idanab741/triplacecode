import Link from "next/link";
import { COLLECTION_TYPE_LABELS, type CollectionCardDto } from "@/services/social/collectionTypes";
import { CollectionCover } from "./CollectionCover";
import { collectionPath } from "./CollectionActionBar";

/** כרטיס "אלבום" של אוסף - Grid ויזואלי בטאב "אוספים" בפרופיל: Cover/Collage, שם, "8 מקומות" / "5 טיולים". */
export function CollectionAlbumCard({ item }: { item: CollectionCardDto }) {
  return (
    <Link href={collectionPath(item.id)} className="flex flex-col gap-1.5">
      <div className="overflow-hidden rounded-card shadow-soft">
        <CollectionCover coverUrl={item.coverUrl} collageUrls={item.collageUrls} type={item.type} className="aspect-square" />
      </div>
      <div className="px-0.5">
        <p className="line-clamp-1 text-[14px] font-bold text-ink">{item.title}</p>
        <p className="text-[12px] text-ink-secondary">
          {COLLECTION_TYPE_LABELS[item.type].itemCount(item.itemCount)}
          {item.visibility === "private" ? " · פרטי" : ""}
        </p>
      </div>
    </Link>
  );
}
