import { isMainOnboardingComplete, isProfileComplete, type Profile } from "@/services/profile/profileService";

/** לאן לנתב משתמש מיד אחרי התחברות/הרשמה, לפי מצב הפרופיל וההעדפות שלו.
 *
 *  נקודת ההחלטה המרכזית - נקראת מ-src/app/auth/page.tsx (התחברות/הרשמה
 *  ישירה באימייל+סיסמה, בלי אישור מייל) וגם מקבילה בשרת ב-
 *  /auth/callback/route.ts (Google/Apple/קישור אישור מייל). שני המקומות
 *  בודקים את אותו שדה DB בדיוק - profiles.intro_completed_at - ולא
 *  localStorage, כי הגרסה בשרת חייבת לקרוא את זה בלי גישה לדפדפן. */
export function getPostAuthPath(
  profile: Profile | null
): string {
  if (!isProfileComplete(profile)) return "/profile-setup";
  if (!isMainOnboardingComplete(profile)) return "/onboarding";
  return "/home";
}
