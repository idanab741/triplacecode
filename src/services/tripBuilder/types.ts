export type TripType =
  | "day_trip"
  | "nature_trip"
  | "weekend"
  | "romantic_date"
  | "restaurants_cafes"
  | "nightlife"
  | "abroad_vacation";

export type SessionStatus = "questionnaire" | "planning" | "building" | "completed" | "abandoned";

/** "nightlife" נוסף רק לתפקידי-סלוט של חופשה בחו"ל (buildMultiDayVacationPlan,
 *  דטרמיניסטי לגמרי, בלי AI) - תחנת חיי לילה מקובעת בסוף היום, שנשלפת
 *  מ-fetchNightlifeCandidatePool (סינון category="nightlife" ישיר,
 *  לא trip_type_tags) ולא דרך fetchCandidatePool הרגיל. */
export type StopRole = "attraction" | "food" | "coffee_dessert" | "viewpoint" | "bar" | "spa" | "nightlife";

export type StopStatus = "pending" | "liked" | "rejected" | "skipped";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TripBuilderSession {
  id: string;
  user_id: string;
  trip_type: TripType;
  status: SessionStatus;
  answers: Record<string, unknown>;
  origin_latitude: number | null;
  origin_longitude: number | null;
  category_plan: CategoryPlanItem[];
  final_itinerary: FinalItinerary | null;
  trip_intent: import("./tripIntentService").TripIntent | null;
  /** בקשה מפורשת - Context Engine (VacationContext) לחופשה בחו"ל: מאוחד
   *  פעם אחת בתחילת auto-build (ר' vacationContext.ts), ומועבר (לא נבנה
   *  מחדש) לכל קריאת Blueprint של כל יום. עמודה נפרדת בכוונה מ-answers -
   *  answers הוא "מה שהמשתמש ענה" גולמי, זה "מה שהמערכת חישבה מזה". */
  vacation_context?: VacationContext | null;
  created_at: string;
  updated_at: string;
}

/** בקשה מפורשת (Context Engine, MASTER PROMPT סעיף 9) - אובייקט מאוחד
 *  אחד שכל שכבת התכנון (בעיקר generateDayBlueprint) מקבלת, במקום לאסוף
 *  שוב DNA/טיסות/מלון בכל קריאה בנפרד. נבנה פעם אחת ב-buildVacationContext. */
export interface VacationContext {
  user: {
    interests: string[];
    kosher: boolean;
    accessibility: boolean;
  };
  trip: {
    destination: string;
    startDate: string;
    endDate: string;
    numDays: number;
    travelers: number;
    hasChildren: boolean;
    /** בקשה מפורשת - בחירה מרובה למי מטיילים (למשל "זוג, חברים") - כדי
     *  שה-AI יראה את ההרכב המלא שנבחר, לא רק ספירה גסה. */
    companionsLabel: string;
    budgetBand: string;
    pace: string;
    vacationTypes: string[];
    freeText: string;
  };
  logistics: {
    hasFlights: boolean;
    hasHotel: boolean;
    hotelName: string | null;
  };
  destination: {
    centralNeighborhoodName: string | null;
  };
  live: {
    weatherSummary: string | null;
  };
}

/**
 * בקשה מפורשת - הפלט היחיד של קריאת ה-AI המרכזית לכל יום "רגיל" (לא
 * יום 1, לא יום אחרון - אלה נשארים דטרמיניסטיים לגמרי, בלי Blueprint).
 * בכוונה **לא** מכיל שום שם מקום ספציפי - רק אסטרטגיה ברמת-על. הבחירה
 * בפועל של המקומות נשארת אצל fetchCandidatePool/rankCandidatesFast, לא
 * אצל ה-AI. ר' dayBlueprintService.ts.
 */
export interface DayBlueprint {
  /** כותרת קצרה וטבעית ליום, למשל "דובאי הקלאסית" - משמשת גם כ-dayTitle בתוצאה הסופית. */
  title: string;
  /** כמה תחנות "אטרקציה" ביום הזה - סטייה אמיתית מהתבנית הקבועה (2-4). */
  attractionsCount: number;
  /** true = מסעדת צהריים בנוסף לערב (כמו התבנית הקבועה); false = יום קליל יותר, ארוחה אחת בלבד. */
  includeSecondFoodStop: boolean;
  /** 1-2 קטגוריות מתוך vacationTypes שהיום הזה מתמקד בהן - קוד ממפה אותן ל-trip_type_tags בפועל. */
  focusCategories: string[];
}

export interface TripBuilderStop {
  id: string;
  session_id: string;
  category: string;
  slot_index: number;
  role: StopRole;
  status: StopStatus;
  place_id: string | null;
  score: number | null;
  reason: string | null;
  rejected_place_ids: string[];
  day_index: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryPlanItem {
  category: string;
  role: StopRole;
  order: number;
  /** ×™×•× ×‘×ª×•×š ×ž×¡×œ×•×œ ×ž×¨×•×‘×”-×™×ž×™× (1, 2, 3...) - null ×œ×˜×™×•×œ×™× ×—×“-×™×•×ž×™×™×. */
  day?: number | null;
  /** ×ª×™××•×¨ ×§×¦×¨ ×‘×¢×‘×¨×™×ª ×©×œ ×ž×” ×‘×“×™×•×§ ×”×ª×—× ×” ×”×–×• ××ž×•×¨×” ×œ×”×™×•×ª, ×œ×¤×™ ×”×ž×œ×œ ×”×—×•×¤×©×™
   *  (×œ×ž×©×œ "×¢×’×œ×ª ×§×¤×” ×‘×¡×‘×™×‘×” ×˜×‘×¢×™×ª", ×œ× ×¨×§ role="coffee_dessert"). ×‘×œ×™ ×–×”,
   *  ×©×œ×‘ ×‘×—×™×¨×ª ×”×ž×§×•× ×”×¡×¤×¦×™×¤×™ (generateDayTripPlaces) ×ž×§×‘×œ ×¨×§ role/category
   *  ×’× ×¨×™×™× ×•×¦×¨×™×š "×œ× ×—×© ×ž×—×“×©" ××ª ×”×›×•×•× ×” ×”×ž×“×•×™×§×ª ×ž×ª×•×š ×”×ž×œ×œ ×”×—×•×¤×©×™ ×”×ž×œ× -
   *  ×•×–×” × ×›×©×œ ×‘×¤×•×¢×œ. */
  note?: string;
}

export interface CandidatePlace {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  shortDescription: string | null;
  imageUrls: string[];
  rating: number | null;
  ratingCount: number | null;
  priceLevel: number | null;
  estimatedVisitMinutes: number | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  etaMinutes: number;
  score?: number;
  reason?: string;
  source?: "ai" | "fallback";
tripTypeTags: string[];
  cuisineTags: string[];
  tags?: string[];
  tripmatchScores?: Record<string, number>;
  dnaScores?: Record<string, number>;
  kosher: boolean | null;
  accessible: boolean | null;
  suitableChildAges: string[];
  budgetTier: string | null;
  isAreaExperience: boolean;
}

export interface FinalItineraryStop {
  stopId: string;
  placeId: string;
  name: string;
  category: string;
  imageUrls: string[];
  etaMinutes: number;
  arrivalOffsetMinutes: number;
  estimatedVisitMinutes: number | null;
  priceLevel: number | null;
  rating: number | null;
  reason: string | null;
  shortDescription: string | null;
  latitude: number;
  longitude: number;
  openingHours: string[] | null;
  dayIndex: number | null;
  /** תפקיד התחנה (attraction/food/coffee_dessert/nightlife/וכו') - נשמר
   *  כאן (לא רק category) כדי שיישור השעות (alignStopTimesToWholeHours,
   *  finalizeService.ts) ידע להבחין בין ארוחת בוקר/צהריים/ערב לאטרקציה. */
  role?: string;
  /** ×¡×•×’ ×ª×—× ×” ×ž×™×•×—×“×ª (× ×—×™×ª×”/×¦'×§-××™×Ÿ/×¦'×§-×××•×˜/×˜×™×¡×ª ×—×–×¨×”) - null ×œ×ª×—× ×” ×¨×’×™×œ×”. ×ž×©×ž×©
   *  ×œ×ª×¦×•×’×” ×‘×œ×‘×“, ×œ× × ×©×œ×£ ×ž-DB/AI. */
  specialType?: "landing" | "hotel_checkin" | "hotel_checkout" | "return_flight" | "neighborhood" | null;
  /** ×§×™×©×•×¨ ×œ×”×–×ž× ×ª × ×¡×™×¢×” (Google Maps directions - ×”×ž×©×ª×ž×© ×‘×•×—×¨ ×©× ××•×‘×¨/×ž×•× ×™×ª/
   *  ×ª×—×‘×•×¨×” ×¦×™×‘×•×¨×™×ª) - ×¨×§ ×œ×ª×—× ×•×ª ×œ×•×’×™×¡×˜×™×§×” (× ×—×™×ª×”/×˜×™×¡×ª ×—×–×¨×”). null/undefined ×œ×ª×—× ×” ×¨×’×™×œ×”. */
  directionsUrl?: string | null;
}

export interface FinalItineraryEvent {
  id: string;
  name: string;
  date: string | null;
  venueName: string | null;
  imageUrl: string | null;
  url: string;
}

export interface FinalItinerary {
  stops: FinalItineraryStop[];
  events: FinalItineraryEvent[];
  totalEtaMinutes: number;
  warnings: string[];
  /** בקשה מפורשת - כותרת קצרה וטבעית לכל יום (למשל "נחיתה והיכרות",
   *  "דובאי הקלאסית") - נגזרת דטרמיניסטית מתוך הקטגוריות שבפועל נבחרו
   *  ליום הזה (ר' deriveDayTitle ב-finalizeService.ts), לא קריאת AI
   *  נוספת. מפתח = מספר היום כמחרוזת (JSON keys הם תמיד string). */
  dayTitles?: Record<string, string>;
}

export type CompanionType = "couple" | "family" | "family_no_kids" | "friends" | "solo" | "with_pet";
export type ChildAgeBand = "0-3" | "3-7" | "7-12" | "12-18";
export type TimingChoice = "today" | "tomorrow" | "other_date";
export type DistanceBand =
  | "10min" | "20min" | "30min" | "40min" | "50min"
  | "1h" | "1.5h" | "2h" | "2.5h" | "3h" | "4h" | "5h";
export type BudgetBand = "0-100" | "100-300" | "300-600" | "600-1000" | "unlimited";
export type DurationBand = "1-2h" | "half_day" | "full_day";
export interface DayTripAnswers {
  companions: CompanionType[];
  hasPet: boolean;
  childAgeBands: ChildAgeBand[];
  timing: TimingChoice;
  otherDate: string | null;
  distanceBand: DistanceBand;
  budgetBand: BudgetBand;
  interests: string[];
  durationBand: DurationBand;
  freeText: string;
}

export type DifficultyLevel = "easy" | "moderate" | "challenging";
/** ×›×ž×• DurationBand, + "custom" (×–×ž×Ÿ ×ž×•×ª×× ××™×©×™×ª) - ×¨×œ×•×•× ×˜×™ ×¨×§ ×œ×˜×™×•×œ ×‘×˜×‘×¢. */
export type NatureDurationBand = DurationBand | "custom";

export interface NatureTripAnswers {
  companions: CompanionType[];
  hasPet: boolean;
  childAgeBands: ChildAgeBand[];
  timing: TimingChoice;
  otherDate: string | null;
  distanceBand: DistanceBand;
  budgetBand: BudgetBand;
  natureTypes: string[];
  difficulty: DifficultyLevel;
  durationBand: NatureDurationBand;
  /** ×¨×œ×•×•× ×˜×™ ×¨×§ ×× durationBand === "custom" - ×ª×™××•×¨ ×—×•×¤×©×™ ×©×œ ×”×–×ž×Ÿ ×”×¨×¦×•×™. */
  customDuration: string | null;
  freeText: string;
}

export interface RestaurantAnswers {
  companions: CompanionType;
  hasPet: boolean;
  childAgeBands: ChildAgeBand[];
  timing: TimingChoice;
  otherDate: string | null;
  distanceBand: DistanceBand;
  budgetBand: BudgetBand;
  cuisine: string[];
  freeText: string;
}

export interface StepOption {
  value: string;
  label: string;
  emoji?: string;
  imageSrc?: string;
}

export interface SingleStep {
  type: "single";
  key: string;
  title: string;
  options: StepOption[];
}

export interface CompanionsStep {
  type: "companions";
  key: string;
  title: string;
  options: StepOption[];
  childAgeKey: string;
  childAgeTitle: string;
  childAgeOptions: StepOption[];
  childAgeTriggerValue: string;
  /** בקשה מפורשת - בטיול יומי/בטבע/סופ"ש/חופשה בחו"ל אפשר לבחור כמה
   *  אפשרויות (למשל "זוג" + "חברים") - לא רק אחת. ברירת מחדל: false
   *  (בחירה יחידה, כמו בחיי לילה ומסעדות). */
  multiSelect?: boolean;
}

export interface DateStep {
  type: "date";
  key: string;
  title: string;
  options: StepOption[];
  otherDateKey: string;
  otherDateTriggerValue: string;
}

export interface SliderStep {
  type: "slider";
  key: string;
  title: string;
  steps: StepOption[];
}

export interface MultiEmojiStep {
  type: "multi-emoji";
  key: string;
  title: string;
  options: StepOption[];
}

export interface TextStep {
  type: "text";
  key: string;
  title: string;
  placeholder: string;
}

export type TripBuilderStep =
  | SingleStep
  | CompanionsStep
  | DateStep
  | SliderStep
  | MultiEmojiStep
  | TextStep;

  export type DateWithType =
  | "partner"
  | "first_date"
  | "multiple_dates"
  | "anniversary"
  | "proposal"
  | "special_event";

export interface RomanticDateAnswers {
  dateWith: DateWithType;
  timing: TimingChoice;
  otherDate: string | null;
  distanceBand: DistanceBand;
  budgetBand: BudgetBand;
  dateType: string[];
  freeText: string;
 }

export type NightlifeCompanionType = "couple" | "friends" | "group" | "solo";
export type GroupSizeBand = "5-10" | "10-20" | "20+";

export interface NightlifeAnswers {
  companions: NightlifeCompanionType;
  groupSize: GroupSizeBand | null;
  timing: TimingChoice;
  otherDate: string | null;
  distanceBand: DistanceBand;
  budgetBand: BudgetBand;
  venueTypes: string[];
  freeText: string;
}
export type VacationCompanionType = "couple" | "family" | "family_no_kids" | "friends" | "solo" | "with_pet";
export type VacationPace = "relaxed" | "balanced" | "packed";
export type LodgingType = "hotel" | "resort" | "apartment" | "cabin" | "hostel" | "camping" | "glamping" | "villa";
export type TravelStyle = "single_destination" | "multi_destination";

export interface FlightInfo {
  flightNumber: string | null;
  departureTime: string;
  arrivalTime: string;
}

export interface HotelInfo {
  name: string;
  address: string;
}

export type FlightPreference = "direct" | "one_stop" | "two_plus_stops";

export interface AbroadVacationAnswers {
  companions: VacationCompanionType[];
  childAgeBands: ChildAgeBand[];
  startDate: string;
  endDate: string;
  hasBookedFlightAndHotel: boolean;
  flightPreference: FlightPreference | null;
  flights: FlightInfo[];
  hotels: HotelInfo[];
  lodgingType: LodgingType | null;
  budgetPerPerson: string;
  vacationTypes: string[];
  destination: string | null;
  /** ×™×¢×“×™× × ×•×¡×¤×™× - ×¨×œ×•×•× ×˜×™ ×›×©-travelStyle ×”×•× multi_destination. */
  destinations: string[];
  surpriseMe: boolean;
  pace: VacationPace;
  travelStyle: TravelStyle;
  freeText: string;
}
export interface WeekendAnswers {
  companions: VacationCompanionType[];
  childAgeBands: ChildAgeBand[];

  startDate: string;
  endDate: string;

  distanceBand: DistanceBand;

  hasBookedLodging: boolean;
  lodgingName: string | null;
  lodgingAddress: string | null;

  lodgingType: LodgingType | null;

  weekendStyles: string[];

  pace: VacationPace;

  budgetPerPerson: string;

  freeText: string;
}
