import { isProfileComplete, type Profile } from "@/services/profile/profileService";
import { isPreferencesComplete, type UserPreferences } from "@/services/preferences/preferencesService";

/** לאן לנתב משתמש מיד אחרי התחברות/הרשמה, לפי מצב הפרופיל וההעדפות שלו. */
export function getPostAuthPath(
  profile: Profile | null,
  preferences: UserPreferences | null
): string {
  if (!isProfileComplete(profile)) return "/profile-setup";
  if (!isPreferencesComplete(preferences)) return "/preferences";
  return "/home";
}
