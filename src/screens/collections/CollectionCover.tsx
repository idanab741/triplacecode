import type { CollectionType } from "@/services/social/collectionTypes";

interface CollectionCoverProps {
  /** Cover שהיוצר בחר. אם קיים - מוצג לבדו. */
  coverUrl: string | null;
  /** עד 4 תמונות מהפריטים - Cover אוטומטי (Collage) כשאין coverUrl. מדיה קיימת בלבד. */
  collageUrls: string[];
  type: CollectionType;
  /** גודל/יחס (Tailwind) - ההורה קובע. */
  className?: string;
}

/**
 * Cover / Collage של אוסף - אותו רכיב ב-Feed, בפרופיל ובעמוד האוסף, כדי שהאוסף יזוהה ויזואלית בכל מקום.
 * Collage: 1 תמונה = מלאה; 2 = שתי חצאים; 3 = גדולה + שתי קטנות; 4 = 2x2. לא נוצרת שום תמונה חדשה.
 */
export function CollectionCover({ coverUrl, collageUrls, type, className = "aspect-[4/3]" }: CollectionCoverProps) {
  const wrapper = `relative overflow-hidden bg-bg-secondary ${className}`;

  if (coverUrl) {
    return (
      <div className={wrapper}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
      </div>
    );
  }

  const urls = collageUrls.slice(0, 4);
  if (urls.length === 0) {
    return <div className={`${wrapper} flex items-center justify-center text-4xl`}>{type === "places" ? "📍" : "🧳"}</div>;
  }

  const gridClass =
    urls.length === 1 ? "grid-cols-1" : urls.length === 2 ? "grid-cols-2" : urls.length === 3 ? "grid-cols-2 grid-rows-2" : "grid-cols-2 grid-rows-2";

  return (
    <div className={`${wrapper} grid gap-0.5 ${gridClass}`}>
      {urls.map((url, i) => (
        <div key={`${url}-${i}`} className={`relative overflow-hidden ${urls.length === 3 && i === 0 ? "row-span-2" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}
