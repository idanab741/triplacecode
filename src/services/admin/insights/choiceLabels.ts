import * as abroadVacation from "@/locales/he/abroadVacation";
import * as natureTrip from "@/locales/he/natureTrip";
import * as nightlife from "@/locales/he/nightlife";
import * as preferences from "@/locales/he/preferences";
import * as preferencesTaxonomy from "@/locales/he/preferencesTaxonomy";
import * as restaurantsCafes from "@/locales/he/restaurantsCafes";
import * as romanticDate from "@/locales/he/romanticDate";
import * as tripBuilder from "@/locales/he/tripBuilder";
import * as weekend from "@/locales/he/weekend";
import * as quickCategories from "@/constants/quickCategories";
import * as searchCategories from "@/constants/searchCategories";
import { PLACE_CATEGORY_LABELS } from "@/constants/placeCategories";
import { TRIP_TYPE_LABELS } from "./labels";

/**
 * מילון ערך→תווית עברית שנבנה אוטומטית מכל קבצי השאלונים באפליקציה
 * (כל אובייקט בצורת { value|id, label }). כך הדוחות מציגים "זוג" ולא
 * "couple", ואפשרות חדשה שתתווסף לשאלון תקבל תווית בלי לגעת בקוד הזה.
 */
const VALUE_LABELS = new Map<string, string>();

function collect(node: unknown, depth = 0): void {
  if (depth > 6 || node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collect(item, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;
  const key = typeof obj.value === "string" ? obj.value : typeof obj.id === "string" ? obj.id : null;
  if (key && typeof obj.label === "string" && !VALUE_LABELS.has(key)) VALUE_LABELS.set(key, obj.label);
  for (const v of Object.values(obj)) if (v && typeof v === "object") collect(v, depth + 1);
}

for (const mod of [tripBuilder, abroadVacation, natureTrip, nightlife, restaurantsCafes, romanticDate, weekend, preferences, preferencesTaxonomy, searchCategories, quickCategories]) {
  collect(Object.values(mod));
}

const EXTRA: Record<string, string> = {
  ...PLACE_CATEGORY_LABELS,
  ...TRIP_TYPE_LABELS,
  true: "כן",
  false: "לא",
  today: "היום",
  tomorrow: "מחר",
  other_date: "תאריך אחר",
  half_day: "חצי יום",
  full_day: "יום מלא",
  single_destination: "יעד אחד",
  multi_destination: "כמה יעדים",
  packed: "עמוס",
  balanced: "מאוזן",
  relaxed: "רגוע",
  direct: "טיסה ישירה",
  hotel: "מלון",
  easy: "קל",
  moderate: "בינוני",
  hard: "מאתגר",
};

export function choiceLabel(value: string): string {
  return VALUE_LABELS.get(value) ?? EXTRA[value] ?? value;
}

/** שמות השאלות בשאלוני בניית הטיול (מפתחות answers) */
export const QUESTION_LABELS: Record<string, string> = {
  companions: "עם מי יוצאים",
  budgetBand: "תקציב",
  budgetPerPerson: "תקציב לאדם",
  distanceBand: "מרחק נסיעה",
  durationBand: "משך",
  timing: "מתי",
  interests: "תחומי עניין",
  childAgeBands: "גילאי ילדים",
  hasPet: "עם בעל חיים",
  pace: "קצב",
  travelStyle: "סגנון נסיעה",
  surpriseMe: "הפתיעו אותי",
  vacationTypes: "סוג חופשה",
  natureTypes: "סוג טבע",
  difficulty: "רמת קושי",
  cuisine: "מטבח",
  venueTypes: "סוג מקום",
  dateType: "סוג דייט",
  dateWith: "הדייט עם",
  weekendStyles: "סגנון סופ״ש",
  hasBookedLodging: "כבר הזמינו לינה",
  hasBookedFlightAndHotel: "כבר הזמינו טיסה ומלון",
  lodgingType: "סוג לינה",
  flightPreference: "העדפת טיסה",
  groupSize: "גודל קבוצה",
  completedCategories: "קטגוריות שהושלמו",
  customDuration: "משך מותאם",
};

/** שאלות שלא נכנסות לספירת בחירות: טקסט חופשי, תאריכים, שמות ורשימות אובייקטים */
export const SKIP_QUESTIONS = new Set([
  "freeText",
  "startDate",
  "endDate",
  "otherDate",
  "lodgingName",
  "lodgingAddress",
  "hotels",
  "flights",
  "destinations",
  "destination",
  "cityValue",
]);

export const PREFERENCE_FIELDS: { key: string; label: string }[] = [
  { key: "interests", label: "תחומי עניין" },
  { key: "culinary_styles", label: "סגנונות קולינריים" },
  { key: "vacation_preferences", label: "סוגי חופשה" },
  { key: "accommodation_types", label: "סוג לינה" },
  { key: "transportation", label: "תחבורה" },
  { key: "dietary_restrictions", label: "הגבלות תזונה" },
  { key: "accessibility_types", label: "נגישות" },
];
