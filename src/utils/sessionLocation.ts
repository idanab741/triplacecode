/**
 * *** חדש (בקשה מפורשת - "המיקום אמור להישמר כל עוד אתה באפליקציה"):
 * זיכרון קצר-טווח של המיקום של המשתמש ושל היעד הפעיל בעמוד הבית.
 *
 * למה: בכל כניסה מחדש לעמוד הבית (למשל חזרה מעמוד מקום) האפליקציה איתרה
 * מיקום מחדש - GPS + reverse-geocode, כמה שניות של המתנה. עכשיו המיקום
 * נשמר פעם אחת ונקרא מיד.
 *
 * שני מנגנונים ביחד: משתנה במודול (מיידי, שורד ניווט פנימי בלי רענון) +
 * sessionStorage (שורד רענון דף; נמחק כשהאפליקציה/הטאב נסגרים - בדיוק
 * "כל עוד אתה באפליקציה"). כל גישה עטופה ב-try/catch - מצב פרטי/WebView
 * בלי אחסון פשוט מתנהג כמו "אין מיקום שמור".
 */

export interface SessionLocation {
  lat: number;
  lng: number;
  /** שם העיר לחיפוש/תצוגה (כמו שחזר מ-reverse-geocode). */
  city: string;
}

const LOCATION_KEY = "triplace:session-location";
const DESTINATION_KEY = "triplace:session-destination";

let memoryLocation: SessionLocation | null = null;
let memoryDestination: string | null = null;

function readStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value == null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // אחסון לא זמין - נשארים עם הזיכרון בלבד.
  }
}

export function getSessionLocation(): SessionLocation | null {
  if (typeof window === "undefined") return null;
  if (memoryLocation) return memoryLocation;
  const raw = readStorage(LOCATION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionLocation>;
    if (typeof parsed.lat === "number" && typeof parsed.lng === "number" && typeof parsed.city === "string" && parsed.city) {
      memoryLocation = { lat: parsed.lat, lng: parsed.lng, city: parsed.city };
      return memoryLocation;
    }
  } catch {
    // JSON פגום - מתעלמים.
  }
  return null;
}

export function setSessionLocation(location: SessionLocation) {
  memoryLocation = location;
  writeStorage(LOCATION_KEY, JSON.stringify(location));
}

/** היעד שהמשתמש בחר/הגיע אליו כרגע בעמוד הבית - כדי שחזרה לעמוד (אחרי
 *  ביקור בעמוד מקום, למשל) תחזיר אותו לאותו יעד ולא תאפס למיקום שלו. */
export function getSessionDestination(): string | null {
  if (typeof window === "undefined") return null;
  if (memoryDestination) return memoryDestination;
  const raw = readStorage(DESTINATION_KEY);
  if (raw) memoryDestination = raw;
  return memoryDestination;
}

export function setSessionDestination(destination: string) {
  memoryDestination = destination;
  writeStorage(DESTINATION_KEY, destination);
}

export function clearSessionDestination() {
  memoryDestination = null;
  writeStorage(DESTINATION_KEY, null);
}
