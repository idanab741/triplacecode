import { VACATION_TYPE_OPTIONS } from "@/locales/he/abroadVacation";

/**
 * "חלוקה לפי קטגוריות החופשות בחו''ל" (Audit - "כמו שעשינו בהתאמות
 * בחו''ל... ונכניס שם יעדים מותאמים בהמשך"): ממחזר את VACATION_TYPE_OPTIONS
 * הקיים (locales/he/abroadVacation.ts - כבר בשימוש בשאלון ה-Trip Builder
 * של חופשה בחו"ל) - לא נבנתה טקסונומיה חדשה. כרגע (בכוונה, "בהמשך")
 * אלה אריחים ויזואליים בלבד, בלי תוצאות/יעדים מסוננים מאחוריהם עדיין -
 * זה יתווסף בסבב הבא.
 */
export function AbroadVacationCategoryGrid() {
  return (
    <section className="px-6">
      <h3 className="mb-3 text-lg font-semibold text-ink">סוגי חופשות</h3>
      <div className="grid grid-cols-3 gap-3">
        {VACATION_TYPE_OPTIONS.map((option) => (
          <div
            key={option.value}
            className="flex flex-col items-center gap-1.5 rounded-card bg-bg-secondary px-2 py-4 text-center"
          >
            <span className="text-2xl">{option.emoji}</span>
            <span className="text-xs font-medium leading-tight text-ink">{option.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
