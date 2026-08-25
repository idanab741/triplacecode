import Link from "next/link";
import Image from "next/image";

/**
 * "כרטיסייה עם דילים (בקרוב)": מציגה את תמונת ה-triplacedeals במלואה,
 * לחיצה, מובילה לעמוד "בקרוב" הייעודי (/deals). ממחזרת את השפה
 * הוויזואלית של DiscoverCard.tsx (rounded-[30px], shadow-xl, תוכן
 * ברוחב מלא). מוצג גם בעמוד "חופשה בחו''ל" וגם ב"חופשה בארץ" (אותה
 * קומפוננטה, לא Duplicate).
 */
export function DealsComingSoonCard() {
  return (
    <section className="px-6">
      <Link href="/deals" className="block overflow-hidden rounded-[30px] shadow-xl">
        <Image
          src="/images/discover/triplacedeals-banner.png"
          alt="triplacedeals - הדילים והמבצעים המשתלמים ביותר עבורכם"
          width={1200}
          height={675}
          className="block h-auto w-full"
        />
      </Link>
    </section>
  );
}
