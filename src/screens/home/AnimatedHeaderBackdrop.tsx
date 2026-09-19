/**
 * *** חדש (בקשה מפורשת - "רקע הבר העליון התכלת בצורה מעט אנימטיבית, תזוזה
 * יפה וקלה"): שכבת תנועה עדינה מעל גרדיאנט הבר התכלת של עמוד הבית -
 * שתי "הילות" אור רכות שנעות לאט אחת מול השנייה + ברק אלכסוני שעובר
 * לאט על פני הבר. הכל נשאר בגוני התכלת של המותג, בשקיפות נמוכה - תנועה
 * שמורגשת ולא מסיחה.
 *
 * הגרדיאנט עצמו (הבסיס) נשאר על ה-div של הבר ב-home/page.tsx, בלי שינוי.
 * השכבה הזו יושבת בתוכו מאחורי כל התוכן (-z-10 בתוך ה-stacking context של
 * הבר, שמוגדר ע"י relative z-10), ומקוצצת לצורת הבר (פינות תחתונות
 * מעוגלות) ע"י overflow-hidden *עליה בלבד* - כך שתפריט ההצעות של החיפוש
 * והבועה של ההתראות עדיין יכולים לצאת מתחת לבר, כמו קודם.
 * האנימציות (transform/opacity בלבד ברובן) ב-globals.css, ומכובות
 * למי שהגדיר "הפחתת תנועה" במכשיר (prefers-reduced-motion).
 */
interface AnimatedHeaderBackdropProps {
  /** "purple" (בר place's): ההילה השנייה בגוון סגול-ורוד במקום תכלת. */
  tone?: "blue" | "purple";
}

export function AnimatedHeaderBackdrop({ tone = "blue" }: AnimatedHeaderBackdropProps = {}) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-b-[32px]">
      {/* גוון סגול: הילות מאותו סגול בעוצמה נמוכה (לא לבנות) וברק עדין, כדי שהצבע יישאר אחיד. */}
      <div className={`home-header-blob ${tone === "purple" ? "home-header-blob-violet" : "home-header-blob-light"}`} />
      <div className={`home-header-blob ${tone === "purple" ? "home-header-blob-pink" : "home-header-blob-cyan"}`} />
      <div className={tone === "purple" ? "home-header-sheen-soft" : "home-header-sheen"} />
    </div>
  );
}
