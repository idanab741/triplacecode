export type TripType =
  | "day_trip"
  | "nature_trip"
  | "weekend"
  | "romantic_date"
  | "restaurants_cafes"
  | "nightlife"
  | "abroad_vacation";

export type SessionStatus = "questionnaire" | "planning" | "building" | "completed" | "abandoned";

export type StopRole = "attraction" | "food" | "coffee_dessert" | "viewpoint" | "bar" | "spa";

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
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
}

export interface CategoryPlanItem {
  category: string;
  role: StopRole;
  order: number;
  /** יום בתוך מסלול מרובה-ימים (1, 2, 3...) - null לטיולים חד-יומיים. */
  day?: number | null;
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
  /** סוג תחנה מיוחדת (נחיתה/צ'ק-אין/צ'ק-אאוט) - null לתחנה רגילה. משמש
   *  לתצוגה בלבד, לא נשלף מ-DB/AI. */
  specialType?: "landing" | "hotel_checkin" | "hotel_checkout" | null;
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
}

export type CompanionType = "couple" | "family" | "friends" | "solo" | "with_pet";
export type ChildAgeBand = "0-3" | "3-7" | "7-12" | "12-18";
export type TimingChoice = "today" | "tomorrow" | "other_date";
export type DistanceBand =
  | "10min" | "20min" | "30min" | "40min" | "50min"
  | "1h" | "1.5h" | "2h" | "2.5h" | "3h" | "4h" | "5h";
export type BudgetBand = "0-100" | "100-300" | "300-600" | "600-1000" | "unlimited";
export type DurationBand = "1-2h" | "half_day" | "full_day";
export interface DayTripAnswers {
  companions: CompanionType;
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
export type VacationCompanionType = "couple" | "family" | "friends" | "solo" | "with_pet";
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
  companions: VacationCompanionType;
  childAgeBands: ChildAgeBand[];
  startDate: string;
  endDate: string;
  departureAirport: string;
  hasBookedFlightAndHotel: boolean;
  flightPreference: FlightPreference | null;
  flights: FlightInfo[];
  hotels: HotelInfo[];
  lodgingType: LodgingType | null;
  budgetPerPerson: string;
  vacationTypes: string[];
  destination: string | null;
  surpriseMe: boolean;
  pace: VacationPace;
  travelStyle: TravelStyle;
  freeText: string;
}