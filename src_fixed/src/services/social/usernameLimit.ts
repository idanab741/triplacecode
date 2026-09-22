/** שינוי שם משתמש - פעם בחודש (30 יום). משותף לשרת (setUsername) ולעמוד עריכת הפרופיל. ר' migration 0092. */
export const USERNAME_CHANGE_INTERVAL_DAYS = 30;

/** עד מתי שם המשתמש נעול לשינוי, או null אם אפשר לשנות עכשיו. */
export function usernameLockedUntil(changedAt: string | null | undefined): Date | null {
  if (!changedAt) return null;
  const until = new Date(new Date(changedAt).getTime() + USERNAME_CHANGE_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
  return until.getTime() > Date.now() ? until : null;
}

export function formatUnlockDate(date: Date): string {
  return date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function usernameLockedMessage(until: Date): string {
  return `אפשר לשנות שם משתמש פעם בחודש - השינוי הבא אפשרי ב-${formatUnlockDate(until)}`;
}
