/** כינויי שם משתמש ישנים (רק בדפדפן הזה): כשמשנים username, כתובות ישנות (/places/profile/{ישן} - למשל מכפתור "חזור"
 *  או מהיסטוריית הדפדפן) היו מחזירות "פרופיל לא נמצא". שומרים ישן->חדש ב-localStorage, ועמוד הפרופיל מפנה לשם
 *  החדש כשהוא לא מוצא את הישן. שרשראות שינוי (a->b->c) נפתרות עד 5 קפיצות. */
const KEY = "places_username_aliases_v1";

function read(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function rememberUsernameChange(oldName: string | null | undefined, newName: string): void {
  if (!oldName || oldName.toLowerCase() === newName.toLowerCase()) return;
  try {
    const map = read();
    map[oldName.toLowerCase()] = newName;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // localStorage חסום - לא קריטי
  }
}

/** השם הנוכחי של username שהוחלף, או null אם אין כינוי. */
export function resolveUsernameAlias(name: string): string | null {
  const map = read();
  let current = name;
  for (let i = 0; i < 5; i++) {
    const next = map[current.toLowerCase()];
    if (!next || next.toLowerCase() === current.toLowerCase()) break;
    current = next;
  }
  return current.toLowerCase() === name.toLowerCase() ? null : current;
}
