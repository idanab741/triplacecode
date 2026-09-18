/**
 * *** תוספת (בקשה מפורשת - "עמוד הבחירות שלי - שינויים"): מספר הימים
 * שבהם "בחירה" זמנית (טיול/מסלול שלא נשמר במפורש - trip_builder_sessions
 * עם is_saved=false, או trippy_ai_results עם is_saved=false) עדיין
 * מוצגת בלשונית "כל הבחירות"/מוחזרת מה-API, לפני שהיא מפסיקה להופיע
 * לפי המנגנון הקיים (savedTripsService.ts / /api/trippy-ai route.ts).
 * קבוע יחיד ומשותף לשני סוגי התוכן - כדי ששניהם יתנהגו באותו אופן
 * בדיוק, וכדי שחישוב "כמה ימים נשארו" (ר' getDaysRemainingBeforeRemoval)
 * יהיה עקבי בכל מקום שמציג אותו למשתמש (לא טקסט "14 יום" קבוע במספר
 * מקומות בקוד).
 */
export const UNSAVED_CONTENT_RETENTION_DAYS = 14;

/** כמה ימים נשארו לפריט זמני (לא-שמור) לפני שהוא עשוי להיות מוסר, לפי
 *  תאריך היצירה שלו - לעולם לא שלילי. משמש לתצוגה דינמית (למשל "יישמר
 *  עוד 9 ימים") במקום להציג את מספר-הימים הקבוע כטקסט סטטי בכל מקום. */
export function getDaysRemainingBeforeRemoval(createdAtIso: string): number {
  const createdAt = new Date(createdAtIso).getTime();
  const elapsedMs = Date.now() - createdAt;
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return Math.max(0, UNSAVED_CONTENT_RETENTION_DAYS - elapsedDays);
}
