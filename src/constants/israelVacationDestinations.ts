/**
 * תיקון Product מפורש ("חופשה בארץ - אני רוצה שנשנה את הפורמט... רוצה
 * קרוסלה... עם היעדים הבאים"): רשימה סטטית וקבועה (לא DB-driven יותר -
 * ר' vacation-il/discover/page.tsx) של 9 היעדים/אזורים שהוגדרו במפורש,
 * בסדר הזה בדיוק. כל יעד מקבל קואורדינטות מרכז אזור אמיתיות (לא מדויקות
 * לחלוטין - זה אזור, לא כתובת) לשימוש כ-Location קבוע בעמוד היעד
 * הספציפי (destination/[slug]/page.tsx) - מחפש places אמיתיים ברדיוס
 * סביב הנקודה הזו, בדיוק כמו כל Location אחר ב-discoveryService.ts.
 *
 * imageUrl כבר ממופה לנתיבים הצפויים (`/images/vacation-destinations/*.png`,
 * לפי שמות הקבצים בפועל שסופקו: telaviv/jerusalem/eilat/deadsea/
 * tiberias/haifa/mitzperamon/zafongolan/negevarava) - הקבצים עצמם עדיין
 * לא בפרויקט (רק צילום מסך של תיקיית ההורדות התקבל, לא הקבצים עצמם) -
 * ברגע שהם יועלו בפועל, יושמו בדיוק בנתיב הזה ויתחילו לעבוד מיד, בלי
 * שינוי קוד נוסף. עד אז VacationDestinationsCarousel.tsx נופל
 * ל-placeholder עדין (הרכיב כבר תומך ב-imageUrl שלא נטען/לא קיים).
 */
export interface IsraelVacationDestination {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  imageUrl: string | null;
}

export const ISRAEL_VACATION_DESTINATIONS: IsraelVacationDestination[] = [
  { slug: "tel-aviv", name: "תל אביב", lat: 32.0853, lng: 34.7818, imageUrl: "/images/vacation-destinations/telaviv.png" },
  { slug: "jerusalem", name: "ירושלים", lat: 31.7683, lng: 35.2137, imageUrl: "/images/vacation-destinations/jerusalem.png" },
  { slug: "eilat", name: "אילת", lat: 29.5581, lng: 34.9482, imageUrl: "/images/vacation-destinations/eilat.png" },
  { slug: "dead-sea", name: "ים המלח", lat: 31.2, lng: 35.3839, imageUrl: "/images/vacation-destinations/deadsea.png" },
  {
    slug: "tiberias-kinneret",
    name: "טבריה והכנרת",
    lat: 32.7959,
    lng: 35.531,
    imageUrl: "/images/vacation-destinations/tiberias.png",
  },
  { slug: "haifa", name: "חיפה", lat: 32.794, lng: 34.9896, imageUrl: "/images/vacation-destinations/haifa.png" },
  {
    slug: "mitzpe-ramon",
    name: "מצפה רמון",
    lat: 30.6097,
    lng: 34.8014,
    imageUrl: "/images/vacation-destinations/mitzperamon.png",
  },
  {
    slug: "north-golan",
    name: "הצפון והגולן",
    lat: 33.0,
    lng: 35.7,
    imageUrl: "/images/vacation-destinations/zafongolan.png",
  },
  {
    slug: "negev-arava",
    name: "הנגב והערבה",
    lat: 30.7,
    lng: 34.98,
    imageUrl: "/images/vacation-destinations/negevarava.png",
  },
];
