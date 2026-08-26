"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";

interface SurpriseMeSectionProps {
  /** תיקון Product מפורש ("אפשר שהחלק הזה יופיע ב'גלה עוד'?"): כשמוטמע
   *  כשקופית בתוך DiscoverCard (הסווייפר "גלה עוד") - בלי <section
   *  px-6> העוטף/גובה קבוע/rounding+shadow עצמאיים (ה-Swiper ההורה כבר
   *  מספק את כל אלה) - ממלא h-full את השקופית במקום זאת. ברירת המחדל
   *  ("standalone") היא ההתנהגות המקורית, ללא שינוי, לכל שימוש עתידי
   *  עצמאי אחר ברכיב הזה.
   */
  variant?: "standalone" | "embedded";
}

/**
 * "בא לכם לצאת עכשיו?" (Audit - 2 תיקונים נוספים):
 *
 * 1. "צריך שתצא אטרקציה מותאמת אישית! לא יעד": בדיוק כמו התיקון שכבר
 *   נעשה ב"התאמנו לכם" - זה לא אמור לבחור עיר/יעד (destinations table)
 *   אלא מקום/אטרקציה ספציפית (places table) ולנווט ל-/place/[id], לא
 *   ל-/destination/[id]. עכשיו מבקש מיקום אמיתי ובוחר מתוך אותם
 *   "hot places" אמיתיים לפי מיקום (אותה תשתית geo-based בדיוק כמו
 *   "התאמנו לכם"/"מה קורה סביבכם" - fetchHotPlaces, שכבר ממוין לפי
 *   ניקוד משוקלל) - לא endpoint חדש.
 *   *** TODO(backend): "בהתאם ללמידת המשתמש" - עדיין אין דירוג
 *   אישי-פר-מקום מחוץ ל-session פעיל של TripMatch (ר' הערה מפורטת יותר
 *   ב-PersonalizedMatchesSection.tsx) - הבחירה כאן היא רנדומלית מתוך
 *   ה-N המקומות המדורגים הכי גבוה במיקום שלכם, לא "התאמה אישית" אמיתית
 *   עדיין.
 *
 * 2. "הכפתור נהיה פתאום גדול עם כיתוב אחר": זה קרה כי טקסט הטעינה
 *   ("רגע, בוחרים לכם...") היה ארוך יותר מ"תפתיעו אותי" ומתח את
 *   הכפתור. עכשיו הטקסט/גודל של הכפתור קבועים תמיד - אין החלפת טקסט,
 *   רק עמעום עדין (opacity) בזמן הטעינה.
 *
 * 3. תיקון Product מפורש - עברה מסקשן עצמאי בעמוד הבית (בין TrendingSection
 *   ל-PersonalizedMatchesSection) לשקופית בתוך "גלה עוד" (DiscoverCard) -
 *   ר' variant="embedded" למעלה.
 */
export function SurpriseMeSection({ variant = "standalone" }: SurpriseMeSectionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSurpriseMe() {
    if (loading) return;
    setLoading(true);
    try {
      const coords = await getCurrentPositionSafe();
      const res = await fetch(`/api/discovery/day-trip?category=hot&lat=${coords.lat}&lng=${coords.lng}&limit=15`);
      const data = await res.json();
      const places: { id: string }[] = data.places ?? [];
      if (places.length === 0) {
        router.push("/tripmatch");
        return;
      }
      const pick = places[Math.floor(Math.random() * places.length)];
      router.push(`/place/${pick.id}`);
    } catch {
      router.push("/tripmatch");
    } finally {
      setLoading(false);
    }
  }

  const isEmbedded = variant === "embedded";

  const button = (
    <button
      type="button"
      onClick={handleSurpriseMe}
      disabled={loading}
      className={
        isEmbedded
          ? "relative block h-full w-full overflow-hidden text-right transition active:scale-[0.98]"
          : "relative block h-56 w-full overflow-hidden rounded-card text-right shadow-soft transition active:scale-[0.98] sm:h-64"
      }
      style={{
        backgroundImage: "url(/images/home/surprise-me-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: loading ? 0.7 : 1,
      }}
    >
      <div className="absolute inset-y-0 right-0 flex w-[48%] flex-col items-start justify-start gap-2 px-3 pt-5 sm:px-5 sm:pt-6">
        <span className="text-base font-bold leading-tight text-ink sm:text-xl">בא לכם לצאת עכשיו?⚡</span>
        <span className="text-sm leading-snug text-ink-secondary">
          אין תוכניות?
          <br />
          יש לנו רעיון.
        </span>
        <span
          className="mt-1 whitespace-nowrap rounded-pill px-5 py-2.5 text-sm font-semibold text-white shadow-soft"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          תפתיעו אותי
        </span>
      </div>
    </button>
  );

  if (isEmbedded) return button;

  return <section className="px-6">{button}</section>;
}
