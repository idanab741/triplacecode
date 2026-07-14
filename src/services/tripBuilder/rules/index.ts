import type { DurationBand, StopRole, TripBuilderStep, TripType } from "../types";
import {
  DAY_TRIP_QUESTIONS,
  DAY_TRIP_DURATION_RULES,
  DAY_TRIP_PLAN_PROMPT_RULES,
  DAY_TRIP_RANKING_PROMPT_RULES,
} from "./dayTrip";

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
};

export function getTripTypeRules(tripType: TripType): TripTypeRulesConfig {
  const config = TRIP_TYPE_RULES[tripType];
  if (!config) {
    throw new Error(`אין עדיין חוקים מוגדרים לסוג טיול: ${tripType}`);
  }
  return config;
}
