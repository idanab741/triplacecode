export const MIN_PASSWORD_LENGTH = 6;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export const MIN_AGE = 18;
export const MAX_AGE = 120;

/** true אם תאריך הלידה מייצג גיל סביר (בין MIN_AGE ל-MAX_AGE). */
export function isReasonableBirthDate(birthDate: string): boolean {
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  if (date > now) return false;

  let age = now.getFullYear() - date.getFullYear();
  const hasNotHadBirthdayThisYear =
    now.getMonth() < date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() < date.getDate());
  if (hasNotHadBirthdayThisYear) age -= 1;

  return age >= MIN_AGE && age <= MAX_AGE;
}
