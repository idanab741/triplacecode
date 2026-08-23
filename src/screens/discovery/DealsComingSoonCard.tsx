/**
 * "כרטיסייה עם דילים (בקרוב)" (Audit - "הכרטיסייה של triplace מעמוד
 * הבית ב'גלה עוד'"): ממחזר במדויק את השפה הוויזואלית של DiscoverCard.tsx
 * (rounded-[30px], shadow-xl, תוכן ברוחב מלא) - לא את הרכיב עצמו (זה
 * Swiper עם 4 סליידים שמפנים למקומות אחרים באפליקציה - לא רלוונטי כאן,
 * זה כרטיס בודד, "בקרוב", בלי תוכן אמיתי עדיין).
 */
export function DealsComingSoonCard() {
  return (
    <section className="px-6">
      <div className="flex flex-col items-center gap-2 rounded-[30px] bg-[linear-gradient(135deg,var(--color-primary-start)/0.12,var(--color-primary-end)/0.12)] bg-bg-secondary px-6 py-12 text-center shadow-xl">
        <span className="text-4xl">🎉</span>
        <p className="text-lg font-bold text-ink">דילים על חופשות בחו״ל</p>
        <p className="text-sm text-ink-secondary">בקרוב</p>
      </div>
    </section>
  );
}
