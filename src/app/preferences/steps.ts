import {
  CULINARY_STYLES,
  DIETARY_RESTRICTIONS,
  TRANSPORTATION,
  INTERESTS,
  ACCOMMODATION_TYPES,
  VACATION_PREFERENCES,
  type PreferenceOption,
} from "@/locales/he/preferences";

export type MultiFieldKey =
  | "culinary_styles"
  | "dietary_restrictions"
  | "transportation"
  | "interests"
  | "accommodation_types"
  | "vacation_preferences";

export type ToggleFieldKey = "kosher" | "accessibility";

export interface MultiStep {
  type: "multi";
  key: MultiFieldKey;
  title: string;
  options: PreferenceOption[];
}

export interface ToggleStep {
  type: "toggle";
  key: ToggleFieldKey;
  title: string;
}

export type PreferenceStep = MultiStep | ToggleStep;

export const STEPS: PreferenceStep[] = [
  { type: "multi", key: "culinary_styles", title: "סגנון קולינרי", options: CULINARY_STYLES },
  { type: "multi", key: "dietary_restrictions", title: "מגבלות תזונה", options: DIETARY_RESTRICTIONS },
  { type: "toggle", key: "kosher", title: "כשרות" },
  { type: "toggle", key: "accessibility", title: "נגישות" },
  {
    type: "multi",
    key: "transportation",
    title: "מהי דרך ההתניידות המועדפת עליך?",
    options: TRANSPORTATION,
  },
  { type: "multi", key: "interests", title: "תחומי עניין", options: INTERESTS },
  {
    type: "multi",
    key: "accommodation_types",
    title: "סוגי לינה מועדפים",
    options: ACCOMMODATION_TYPES,
  },
  {
    type: "multi",
    key: "vacation_preferences",
    title: "העדפות חופשות בחו\"ל",
    options: VACATION_PREFERENCES,
  },
];

export interface PreferencesFormState {
  culinary_styles: string[];
  dietary_restrictions: string[];
  kosher: boolean;
  accessibility: boolean;
  transportation: string[];
  interests: string[];
  accommodation_types: string[];
  vacation_preferences: string[];
}

export const EMPTY_PREFERENCES_STATE: PreferencesFormState = {
  culinary_styles: [],
  dietary_restrictions: [],
  kosher: false,
  accessibility: false,
  transportation: [],
  interests: [],
  accommodation_types: [],
  vacation_preferences: [],
};
