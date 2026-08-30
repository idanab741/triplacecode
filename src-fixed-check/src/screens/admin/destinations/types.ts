export interface Destination {
  id: string;
  name: string;
  name_en: string | null;
  country: string;
  short_description: string | null;
  full_description: string | null;
  ai_description: string | null;
  image_urls: string[];
  video_urls: string[];
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  website_url: string | null;
  opening_hours: string[];
  recommended_visit_times: string | null;
  price_range: string | null;
  recommended_seasons: string[];
  weather_notes: string | null;
  visit_duration_minutes: number | null;
  internal_rating: number | null;
  google_rating: number | null;
  accessibility_info: string | null;
  parking_info: string | null;
  kid_friendly: boolean | null;
  stroller_friendly: boolean | null;
  pet_friendly: boolean | null;
  kosher: boolean | null;
  reservation_required: boolean | null;
  phone: string | null;
  full_address: string | null;
  seo_title: string | null;
  seo_description: string | null;
  tags: string[];
  status: "draft" | "review" | "approved" | "published" | "archived";
  created_at: string;
  updated_at: string;
}

export const STATUS_OPTIONS: { id: Destination["status"]; label: string }[] = [
  { id: "draft", label: "טיוטה" },
  { id: "review", label: "בבדיקה" },
  { id: "approved", label: "מאושר" },
  { id: "published", label: "פורסם" },
  { id: "archived", label: "בארכיון" },
];

export type DestinationEditForm = {
  name: string;
  name_en: string;
  country: string;
  short_description: string;
  full_description: string;
  ai_description: string;
  image_urls: string; // שורה לכל URL, כמו ב-Places
  video_urls: string;
  latitude: string;
  longitude: string;
  google_place_id: string;
  website_url: string;
  opening_hours: string;
  recommended_visit_times: string;
  price_range: string;
  recommended_seasons: string[];
  weather_notes: string;
  visit_duration_minutes: string;
  internal_rating: string;
  google_rating: string;
  accessibility_info: string;
  parking_info: string;
  kid_friendly: boolean | null;
  stroller_friendly: boolean | null;
  pet_friendly: boolean | null;
  kosher: boolean | null;
  reservation_required: boolean | null;
  phone: string;
  full_address: string;
  seo_title: string;
  seo_description: string;
  tags: string;
  status: Destination["status"];
};

export function destinationToForm(d: Destination): DestinationEditForm {
  return {
    name: d.name,
    name_en: d.name_en ?? "",
    country: d.country,
    short_description: d.short_description ?? "",
    full_description: d.full_description ?? "",
    ai_description: d.ai_description ?? "",
    image_urls: (d.image_urls ?? []).join("\n"),
    video_urls: (d.video_urls ?? []).join("\n"),
    latitude: d.latitude?.toString() ?? "",
    longitude: d.longitude?.toString() ?? "",
    google_place_id: d.google_place_id ?? "",
    website_url: d.website_url ?? "",
    opening_hours: (d.opening_hours ?? []).join("\n"),
    recommended_visit_times: d.recommended_visit_times ?? "",
    price_range: d.price_range ?? "",
    recommended_seasons: d.recommended_seasons ?? [],
    weather_notes: d.weather_notes ?? "",
    visit_duration_minutes: d.visit_duration_minutes?.toString() ?? "",
    internal_rating: d.internal_rating?.toString() ?? "",
    google_rating: d.google_rating?.toString() ?? "",
    accessibility_info: d.accessibility_info ?? "",
    parking_info: d.parking_info ?? "",
    kid_friendly: d.kid_friendly,
    stroller_friendly: d.stroller_friendly,
    pet_friendly: d.pet_friendly,
    kosher: d.kosher,
    reservation_required: d.reservation_required,
    phone: d.phone ?? "",
    full_address: d.full_address ?? "",
    seo_title: d.seo_title ?? "",
    seo_description: d.seo_description ?? "",
    tags: (d.tags ?? []).join(", "),
    status: d.status,
  };
}

export function formToPatchBody(f: DestinationEditForm) {
  return {
    name: f.name,
    name_en: f.name_en || null,
    country: f.country,
    short_description: f.short_description || null,
    full_description: f.full_description || null,
    ai_description: f.ai_description || null,
    image_urls: f.image_urls.split("\n").map((s) => s.trim()).filter(Boolean),
    video_urls: f.video_urls.split("\n").map((s) => s.trim()).filter(Boolean),
    latitude: f.latitude ? Number(f.latitude) : null,
    longitude: f.longitude ? Number(f.longitude) : null,
    google_place_id: f.google_place_id || null,
    website_url: f.website_url || null,
    opening_hours: f.opening_hours.split("\n").map((s) => s.trim()).filter(Boolean),
    recommended_visit_times: f.recommended_visit_times || null,
    price_range: f.price_range || null,
    recommended_seasons: f.recommended_seasons,
    weather_notes: f.weather_notes || null,
    visit_duration_minutes: f.visit_duration_minutes ? Number(f.visit_duration_minutes) : null,
    internal_rating: f.internal_rating ? Number(f.internal_rating) : null,
    google_rating: f.google_rating ? Number(f.google_rating) : null,
    accessibility_info: f.accessibility_info || null,
    parking_info: f.parking_info || null,
    kid_friendly: f.kid_friendly,
    stroller_friendly: f.stroller_friendly,
    pet_friendly: f.pet_friendly,
    kosher: f.kosher,
    reservation_required: f.reservation_required,
    phone: f.phone || null,
    full_address: f.full_address || null,
    seo_title: f.seo_title || null,
    seo_description: f.seo_description || null,
    tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    status: f.status,
  };
}

export function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}
