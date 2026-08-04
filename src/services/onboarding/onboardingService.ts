import { isProfileComplete, type Profile } from "@/services/profile/profileService";
import { isPreferencesComplete, type UserPreferences } from "@/services/preferences/preferencesService";

/** לאן לנתב משתמש מיד אחרי התחברות/הרשמה, לפי מצב הפרופיל וההעדפות שלו.
 *
 *  נקודת ההחלטה המרכזית - נקראת מ-src/app/auth/page.tsx (התחברות/הרשמה
 *  ישירה באימייל+סיסמה, בלי אישור מייל) וגם מקבילה בשרת ב-
 *  /auth/callback/route.ts (Google/Apple/קישור אישור מייל). שני המקומות
 *  בודקים את אותו שדה DB בדיוק - profiles.intro_completed_at - ולא
 *  localStorage, כי הגרסה בשרת חייבת לקרוא את זה בלי גישה לדפדפן. */
export function getPostAuthPath(
  profile: Profile | null,
  preferences: UserPreferences | null
): string {
  if (!isProfileComplete(profile)) return "/profile-setup";
  if (!profile?.intro_completed_at) return "/onboarding";
  if (!isPreferencesComplete(preferences)) return "/preferences";
  return "/home";
}
