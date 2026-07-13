import Link from "next/link";

/** placeholder מעוצב לפיצ'ר תכנון חופשה משותף עתידי. */
export function DiscoverCard() {
  return (
    <div className="px-6">
      <h3 className="mb-3 text-lg font-semibold text-ink">גלה עוד</h3>
      <Link
        href="/ai"
        className="block rounded-card bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] p-6 shadow-soft"
      >
        <p className="text-lg font-bold text-white">מתכננים חופשה מושלמת יחד</p>
        <p className="mt-1 text-sm text-white/80">בקרוב: תכננו טיול ביחד עם חברים ובני משפחה</p>
      </Link>
    </div>
  );
}
