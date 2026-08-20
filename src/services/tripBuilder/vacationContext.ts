import type { TravelDna } from "@/services/travelDna/travelDnaService";
import type { AbroadVacationAnswers, VacationContext } from "./types";
import { VACATION_COMPANION_OPTIONS } from "@/locales/he/abroadVacation";

interface BuildVacationContextParams {
  answers: AbroadVacationAnswers;
  dna: TravelDna | null;
  destinationName: string;
  numDays: number;
  centralNeighborhoodName: string | null;
  weatherSummary: string | null;
}

/**
 * Context Engine (MASTER PROMPT סעיף 9) - מאחד פעם אחת, בתחילת auto-build,
 * את כל המידע שקריאת ה-Blueprint של כל יום צריכה (DNA, טיסות/מלון,
 * תקציב, שכונה מרכזית, מזג אוויר) - כדי שלא ייאסף מחדש בכל קריאת יום
 * בנפרד. נשמר על ה-session (vacation_context) ומועבר כפרמטר בלבד
 * ל-generateDayBlueprint, לא נבנה שם.
 */
export function buildVacationContext(params: BuildVacationContextParams): VacationContext {
  const { answers, dna, destinationName, numDays, centralNeighborhoodName, weatherSummary } = params;

  return {
    user: {
      interests: dna?.interests ?? [],
      kosher: dna?.kosher === true,
      accessibility: dna?.accessibility === true,
    },
    trip: {
      destination: destinationName,
      startDate: answers.startDate,
      endDate: answers.endDate,
      numDays,
      travelers: companionsToTravelerCount(answers.companions),
      hasChildren: (answers.childAgeBands ?? []).length > 0,
      childAgeBands: answers.childAgeBands ?? [],
      companionsLabel: companionsToLabel(answers.companions),
      budgetBand: answers.budgetPerPerson,
      pace: answers.pace,
      vacationTypes: answers.vacationTypes ?? [],
      freeText: answers.freeText ?? "",
    },
    logistics: {
      hasFlights: (answers.flights ?? []).length > 0,
      hasHotel: Boolean(answers.hotels?.[0]?.name),
      hotelName: answers.hotels?.[0]?.name ?? null,
    },
    destination: {
      centralNeighborhoodName,
    },
    live: {
      weatherSummary,
    },
  };
}

function companionsToTravelerCount(companions: AbroadVacationAnswers["companions"]): number {
  // בקשה מפורשת - בחירה מרובה: כשנבחרה יותר מאפשרות אחת (למשל "זוג" +
  // "חברים"), מדובר בפועל בקבוצה גדולה יותר מכל אפשרות בודדת - "כמה"
  // מספיק להקשר של ה-AI, לא צריך להיות מדויק.
  if (companions.length > 1) return 3;
  switch (companions[0]) {
    case "solo":
      return 1;
    case "couple":
      return 2;
    default:
      return 3; // family/friends - מספר לא ידוע מדויק, "כמה" מספיק להקשר
  }
}

/** תווית קריאה-אנושית של כל הבחירות שנבחרו (למשל "זוג, חברים") - כדי
 *  שה-AI שבונה את היום יראה את ההרכב המלא, לא רק ספירה גסה. */
function companionsToLabel(companions: AbroadVacationAnswers["companions"]): string {
  if (companions.length === 0) return "לא צוין";
  return companions
    .map((c) => VACATION_COMPANION_OPTIONS.find((o) => o.value === c)?.label ?? c)
    .join(", ");
}
