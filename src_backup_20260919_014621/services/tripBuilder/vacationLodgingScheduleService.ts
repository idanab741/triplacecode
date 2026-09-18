import type { HotelInfo } from "./types";

/**
 * תיקון פער אמיתי (Audit מול MASTER SPEC - Vacation Abroad, שלב 1 מתוך
 * 3: Check-in/Check-out/Nights): לפני זה, auto-build/route.ts תמיד לקח
 * hotels[0] כ-BASE יחיד לכל הטיול, בלי קשר לכמה מלונות המשתמש הזין
 * (travelStyle="multi_destination" + destinations[]). הפונקציה הזו היא
 * הבסיס שממנו שלב 2 (Multi-Destination בפועל) ייבנה - היא קובעת
 * דטרמיניסטית "באיזה מלון/עיר המשתמש נמצא ביום X", לא בונה עדיין את
 * ה-routing/הבנייה עצמה (זה בכוונה - "אל תעבור לנושא הבא לפני שהקודם עובד").
 */

export interface DayLodgingAssignment {
  dayIndex: number;
  hotel: HotelInfo;
  hotelIndex: number;
  /** true אם השיבוץ מבוסס checkInDate/checkOutDate אמיתיים שהוזנו;
   *  false אם זו ברירת מחדל שקופה (חלוקה שווה של הלילות) כי לא כל
   *  התאריכים הוזנו - לא נתון בדוי, אבל גם לא בהכרח מדויק. */
  isExact: boolean;
}

function toISODateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return toISODateOnly(d);
}

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * מחשבת לכל יום בטיול (1..numDays) איזה מלון/עיר רלוונטי.
 *
 * מקרה 1 - מלון בודד (הרוב המוחלט של הטיולים, כולל single_destination):
 * כל הימים מקבלים אותו מלון - זו בדיוק ההתנהגות המקורית, לא השתנתה.
 *
 * מקרה 2 - כמה מלונות, עם checkInDate+checkOutDate מלאים לכולם: שיבוץ
 * מדויק לפי התאריכים בפועל (isExact=true).
 *
 * מקרה 3 - כמה מלונות, בלי תאריכים מלאים (המשתמש דילג/לא ידוע): fallback
 * שקוף - מחלקים את ימי הטיול שווה בשווה בין המלונות, לפי סדר ההזנה
 * (isExact=false, כדי שקוד קורא יידע שזו הנחה, לא נתון מדויק).
 */
export function computeDayLodgingAssignments(
  hotels: HotelInfo[],
  startDate: string,
  numDays: number
): DayLodgingAssignment[] {
  const validHotels = hotels.filter((h) => h.name || h.address);
  if (validHotels.length === 0) return [];

  if (validHotels.length === 1) {
    return Array.from({ length: numDays }, (_, i) => ({
      dayIndex: i + 1,
      hotel: validHotels[0],
      hotelIndex: 0,
      isExact: true,
    }));
  }

  const allDatesPresent = validHotels.every((h) => h.checkInDate && h.checkOutDate);

  if (allDatesPresent) {
    const assignments: DayLodgingAssignment[] = [];
    for (let dayIndex = 1; dayIndex <= numDays; dayIndex++) {
      const dayDate = addDays(startDate, dayIndex - 1);
      const matchIndex = validHotels.findIndex((h) => dayDate >= h.checkInDate! && dayDate < h.checkOutDate!);
      const resolvedIndex = matchIndex !== -1 ? matchIndex : dayIndex === numDays ? validHotels.length - 1 : 0;
      assignments.push({ dayIndex, hotel: validHotels[resolvedIndex], hotelIndex: resolvedIndex, isExact: true });
    }
    return assignments;
  }

  // Fallback שקוף - אין מספיק נתונים לשיבוץ מדויק, מחלקים שווה בשווה
  // לפי סדר ההזנה. לא ממציאים תאריך ספציפי - רק גוזרים חלוקה סבירה.
  const daysPerHotel = Math.max(1, Math.floor(numDays / validHotels.length));
  const assignments: DayLodgingAssignment[] = [];
  for (let dayIndex = 1; dayIndex <= numDays; dayIndex++) {
    const hotelIndex = Math.min(validHotels.length - 1, Math.floor((dayIndex - 1) / daysPerHotel));
    assignments.push({ dayIndex, hotel: validHotels[hotelIndex], hotelIndex, isExact: false });
  }
  return assignments;
}

/** מספר הלילות במלון נתון, נגזר מהתאריכים - לא נשמר בנפרד (מונע חוסר עקביות אם רק אחד מהם מתעדכן). */
export function nightsForHotel(hotel: HotelInfo): number | null {
  if (!hotel.checkInDate || !hotel.checkOutDate) return null;
  const nights = daysBetween(hotel.checkInDate, hotel.checkOutDate);
  return nights > 0 ? nights : null;
}
