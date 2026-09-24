/** תוויות עבריות משותפות לשרת ולקליינט של מערכת האדמין. */

export const TRIP_TYPE_LABELS: Record<string, string> = {
  day_trip: "טיול יומי",
  nature_trip: "טיול בטבע",
  weekend: "סופ״ש",
  romantic_date: "דייט רומנטי",
  restaurants_cafes: "מסעדות ובתי קפה",
  nightlife: "חיי לילה",
  abroad_vacation: "חופשה בחו״ל",
  tripmatch: "TripMatch → טיול",
  trippy: "Trippy AI",
};

export const TRIP_STATUS_LABELS: Record<string, string> = {
  questionnaire: "בשאלון",
  planning: "בתכנון",
  building: "בבנייה",
  completed: "הושלם",
  abandoned: "ננטש",
};

export const PROVIDER_LABELS: Record<string, string> = {
  email: "אימייל",
  google: "Google",
  apple: "Apple",
  guest: "אורח",
  phone: "טלפון",
};

export const TOKEN_TYPE_LABELS: Record<string, string> = {
  trippy_ai_generation: "יצירת טיול ב-Trippy AI",
  trippy_ai_generation_refund: "החזר - Trippy AI נכשל",
  tripmatch_like: "לייק ב-TripMatch",
  monthly_grant: "הקצאה חודשית",
  admin_grant: "הענקה ע״י אדמין",
};

export const POST_TYPE_LABELS: Record<string, string> = {
  post: "פוסט",
  video: "וידאו",
  review: "ביקורת",
  trip: "טיול",
  place_recommendation: "המלצת מקום",
  destination_recommendation: "המלצת יעד",
  photo: "תמונה",
};

export const PLACE_SOURCE_LABELS: Record<string, string> = {
  smart_search: "Smart Search (AI)",
  google_places: "Google Places",
  user_review: "ביקורות משתמשים",
  ai_trip_builder: "Trip Builder AI",
  admin_curated: "אוצר ע״י אדמין",
};

export const label = (map: Record<string, string>, key: string | null | undefined) => (key ? (map[key] ?? key) : "לא ידוע");
