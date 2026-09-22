import Link from "next/link";

interface TripCardProps {
  title: string;
  imageUrl: string | null;
  stopCount: number;
  /** null = אין דף צפייה זמין לצופה הזה - הכרטיס מוצג בלי ניווט. */
  href: string | null;
  className?: string;
}

/** כרטיס Trip - אותה שפה ויזואלית בדיוק כמו כרטיס "הטיולים שלי" בעמוד הבית (HomeMyTripsRow):
 *  תמונה מלאה, גרדיאנט כהה בתחתית, שם + "N תחנות". בכרטיס הקיים הזה הקוד inline ולא רכיב
 *  משותף, לכן חולץ לכאן כרכיב תצוגה בלבד (בלי לשנות את הקוד הקיים). */
export function TripCard({ title, imageUrl, stopCount, href, className = "aspect-square w-full" }: TripCardProps) {
  const content = (
    <>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-3xl">🧳</div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.75)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2.5 pt-10">
        <p className="truncate text-sm font-bold leading-tight text-white">{title}</p>
        <p className="text-[11px] text-white/85">{stopCount} תחנות</p>
      </div>
    </>
  );
  const base = `relative block overflow-hidden rounded-card bg-bg-secondary text-right shadow-soft ${className}`;
  return href ? (
    <Link href={href} className={`${base} transition active:scale-[0.97]`}>
      {content}
    </Link>
  ) : (
    <div className={base}>{content}</div>
  );
}
