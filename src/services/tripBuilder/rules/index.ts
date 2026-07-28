import type { DurationBand, StopRole, TripBuilderStep, TripType } from "../types";
import {
  DAY_TRIP_QUESTIONS,
  DAY_TRIP_DURATION_RULES,
  DAY_TRIP_PLAN_PROMPT_RULES,
  DAY_TRIP_RANKING_PROMPT_RULES,
} from "./dayTrip";
import {
  RESTAURANTS_CAFES_QUESTIONS,
  RESTAURANTS_CAFES_DURATION_RULES,
  RESTAURANTS_CAFES_PLAN_PROMPT_RULES,
  RESTAURANTS_CAFES_RANKING_PROMPT_RULES,
} from "./restaurantsCafes";
import {
  ROMANTIC_DATE_QUESTIONS,
  ROMANTIC_DATE_DURATION_RULES,
  ROMANTIC_DATE_PLAN_PROMPT_RULES,
  ROMANTIC_DATE_RANKING_PROMPT_RULES,
} from "./romanticDate";
import {
  NIGHTLIFE_QUESTIONS,
  NIGHTLIFE_DURATION_RULES,
  NIGHTLIFE_PLAN_PROMPT_RULES,
  NIGHTLIFE_RANKING_PROMPT_RULES,
} from "./nightlife";
import {
  ABROAD_VACATION_QUESTIONS,
  ABROAD_VACATION_DURATION_RULES,
  ABROAD_VACATION_PLAN_PROMPT_RULES,
  ABROAD_VACATION_RANKING_PROMPT_RULES,
} from "./abroadVacation";

export interface TripTypeRulesConfig {
  questions: TripBuilderStep[];
  durationRules: Record<string, { roles: StopRole[] }>;
  planPromptRules: string;
  rankingPromptRules: string;
}

/**
 * מפה מרכזית של כל סוגי הטיולים לחוקים שלהם.
 * הוספת סוג טיול עתידי = קובץ rules/<type>.ts חדש + שורה כאן.
 * שום קובץ אחר במנוע לא צריך להשתנות.
 */
export const TRIP_TYPE_RULES: Partial<Record<TripType, TripTypeRulesConfig>> = {
  day_trip: {
    questions: DAY_TRIP_QUESTIONS,
    durationRules: DAY_TRIP_DURATION_RULES as Record<DurationBand, { roles: StopRole[] }>,
    planPromptRules: DAY_TRIP_PLAN_PROMPT_RULES,
    rankingPromptRules: DAY_TRIP_RANKING_PROMPT_RULES,
  },
restaurants_cafes: {
    questions: RESTAURANTS_CAFES_QUESTIONS,
    durationRules: RESTAURANTS_CAFES_DURATION_RULES as Record<DurationBand, { roles: StopRole[] }>,
    planPromptRules: RESTAURANTS_CAFES_PLAN_PROMPT_RULES,
    rankingPromptRules: RESTAURANTS_CAFES_RANKING_PROMPT_RULES,
  },
romantic_date: {
    questions: ROMANTIC_DATE_QUESTIONS,
    durationRules: ROMANTIC_DATE_DURATION_RULES as Record<DurationBand, { roles: StopRole[] }>,
    planPromptRules: ROMANTIC_DATE_PLAN_PROMPT_RULES,
    rankingPromptRules: ROMANTIC_DATE_RANKING_PROMPT_RULES,
  },
nightlife: {
    questions: NIGHTLIFE_QUESTIONS,
    durationRules: NIGHTLIFE_DURATION_RULES as Record<DurationBand, { roles: StopRole[] }>,
    planPromptRules: NIGHTLIFE_PLAN_PROMPT_RULES,
    rankingPromptRules: NIGHTLIFE_RANKING_PROMPT_RULES,
  },
  abroad_vacation: {
    questions: ABROAD_VACATION_QUESTIONS,
    durationRules: ABROAD_VACATION_DURATION_RULES as Record<DurationBand, { roles: StopRole[] }>,
    planPromptRules: ABROAD_VACATION_PLAN_PROMPT_RULES,
    rankingPromptRules: ABROAD_VACATION_RANKING_PROMPT_RULES,
  },
};

export function getTripTypeRules(tripType: TripType): TripTypeRulesConfig {
  const config = TRIP_TYPE_RULES[tripType];
  if (!config) {
    throw new Error(`אין עדיין חוקים מוגדרים לסוג טיול: ${tripType}`);
  }
  return config;
}
