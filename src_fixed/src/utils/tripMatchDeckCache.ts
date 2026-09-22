import type { CandidatePlace } from "@/services/tripBuilder/types";

/**
 * *** חדש (בקשה מפורשת - "הכרטיסיות אמורות לעלות מיידית"): מטמון בזיכרון של
 * "חפיסת" הכרטיסיות שכבר נטענה ליעד, כולל מה שכבר הוחלט עליו ומה שנאהב.
 *
 * למה: TripMatch המוטמע בעמוד הבית נבנה מחדש בכל כניסה לעמוד (למשל חזרה
 * מעמוד מקום אחרי לחיצה על כרטיסייה) - וכל פעם שלח בקשה חדשה לשרת, שבנתה
 * session חדש וחפיסה חדשה (ולכן גם "איבדה" את מקום המשתמש). עכשיו החזרה
 * משחזרת בדיוק את אותו session, אותו סדר, ואת אותו מיקום בחפיסה - מיידית.
 *
 * זיכרון בלבד (לא sessionStorage): החפיסה כבדה (עד ~60 מקומות עם תמונות),
 * והיא רלוונטית רק לניווט פנימי באפליקציה. תוקף 30 דקות - אחרי זה נטענת
 * חפיסה טרייה.
 */

export interface CachedDeckPreferences {
  interests: string[];
  culinaryStyles: string[];
  kosher: boolean;
  accessibility: boolean;
}

export interface CachedDeck {
  sessionId: string;
  cityValue: string;
  cityLabel: string;
  candidates: CandidatePlace[];
  userPreferences: CachedDeckPreferences | null;
  decidedIds: string[];
  likedPlaces: CandidatePlace[];
  savedAt: number;
}

const TTL_MS = 30 * 60 * 1000;
const store = new Map<string, CachedDeck>();

export function readDeck(key: string): CachedDeck | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function writeDeck(key: string, deck: Omit<CachedDeck, "savedAt">) {
  store.set(key, { ...deck, savedAt: Date.now() });
}

export function clearDeck(key: string) {
  store.delete(key);
}
