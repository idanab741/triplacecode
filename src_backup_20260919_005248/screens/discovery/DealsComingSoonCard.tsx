import Link from "next/link";
import Image from "next/image";

interface DealsComingSoonCardProps {
  /** תיקון Product מפורש ("רק זה בלבד! השני אמור להיות בחופשות בארץ"):
   *  שתי תמונות שונות לגמרי לשני העמודים - "abroad" (סנטוריני, נוף
   *  חו"ל) לעמוד "חופשה בחו''ל", "domestic" (הנוף המקורי) לעמוד
   *  "חופשה בארץ". ברירת המחדל "domestic" שומרת על ההתנהגות הקיימת
   *  לכל קורא שלא מציין במפורש. */
  variant?: "domestic" | "abroad";
}

const BANNER_BY_VARIANT: Record<NonNullable<DealsComingSoonCardProps["variant"]>, string> = {
  domestic: "/images/discover/triplacedeals-banner.png",
  abroad: "/images/discover/triplacedeals-banner-abroad.png",
};

/**
 * "כרטיסייה עם דילים (בקרוב)": מציגה את תמונת ה-triplacedeals במלואה,
 * לחיצה, מובילה לעמוד "בקרוב" הייעודי (/deals). ממחזרת את השפה
 * הוויזואלית של DiscoverCard.tsx (rounded-[30px], shadow-xl, תוכן
 * ברוחב מלא). מוצג גם בעמוד "חופשה בחו''ל" וגם ב"חופשה בארץ" (אותה
 * קומפוננטה, לא Duplicate) - עכשיו עם תמונת רקע שונה לכל עמוד לפי
 * variant (ר' למעלה).
 */
export function DealsComingSoonCard({ variant = "domestic" }: DealsComingSoonCardProps) {
  return (
    <section className="px-6">
      <Link href="/deals" className="block overflow-hidden rounded-[30px] shadow-xl">
        <Image
          src={BANNER_BY_VARIANT[variant]}
          alt="triplacedeals - הדילים והמבצעים המשתלמים ביותר עבורכם"
          width={1200}
          height={675}
          className="block h-auto w-full"
        />
      </Link>
    </section>
  );
}
