/**
 * ╫₧╫Ö╫ñ╫ò╫Ö ╫æ╫Ö╫ƒ ╫₧╫û╫ö╫Ö╫¥ ╫Ö╫ª╫Ö╫æ╫Ö╫¥ (slugs, ╫á╫⌐╫₧╫¿╫Ö╫¥ ╫æ-DB) ╫£╫¬╫ª╫ò╫Æ╫ö ╫æ╫ó╫æ╫¿╫Ö╫¬.
 * ╫ö╫ó╫¿╫¢╫Ö╫¥ ╫æ╫É╫á╫Æ╫£╫Ö╫¬ ╫£╫É ╫₧╫⌐╫¬╫á╫Ö╫¥ ╫£╫ó╫ò╫£╫¥ ΓÇö ╫¿╫º ╫ö╫¬╫ò╫ò╫Ö╫ò╫¬ ╫æ╫ó╫æ╫¿╫Ö╫¬ ╫Ö╫¢╫ò╫£╫ò╫¬ ╫£╫ö╫⌐╫¬╫á╫ò╫¬.
 */

export interface PreferenceOption {
  value: string;
  label: string;
  /** ╫¬╫₧╫ò╫á╫¬ ╫¿╫º╫ó ╫£╫¢╫¿╫ÿ╫Ö╫í ╫ö╫æ╫ù╫Ö╫¿╫ö (public/images/preferences/...) - ╫É╫ò╫ñ╫ª╫Ö╫ò╫á╫£╫Ö, ╫£╫É ╫£╫¢╫£ ╫ö╫É╫ò╫ñ╫ª╫Ö╫ò╫¬ ╫Ö╫⌐ ╫¬╫₧╫ò╫á╫ö ╫ó╫ô╫Ö╫Ö╫ƒ. */
  imageSrc?: string;
}

export const CULINARY_STYLES: PreferenceOption[] = [
  { value: "israeli", label: "╫Ö╫⌐╫¿╫É╫£╫Ö", imageSrc: "/images/preferences/culinary/israeli.png" },
  { value: "italian", label: "╫É╫Ö╫ÿ╫£╫º╫Ö", imageSrc: "/images/preferences/culinary/italian.png" },
  { value: "asian", label: "╫É╫í╫Ö╫Ö╫¬╫Ö", imageSrc: "/images/preferences/culinary/asian.png" },
  { value: "meat_bbq", label: "╫æ╫⌐╫¿╫Ö╫¥ ╫ò╫ó╫£ ╫ö╫É╫⌐", imageSrc: "/images/preferences/culinary/meat_bbq.png" },
  { value: "burger_diner", label: "╫ö╫₧╫æ╫ò╫¿╫Æ╫¿ ╫ò╫ô╫Ö╫Ö╫á╫¿ ╫É╫₧╫¿╫Ö╫º╫É╫Ö", imageSrc: "/images/preferences/culinary/burger_diner.png" },
  { value: "mexican", label: "╫₧╫º╫í╫Ö╫º╫á╫Ö", imageSrc: "/images/preferences/culinary/mexican.png" },
  { value: "greek", label: "╫Ö╫ò╫ò╫á╫Ö", imageSrc: "/images/preferences/culinary/greek.png" },
  { value: "french_bistro", label: "╫æ╫Ö╫í╫ÿ╫¿╫ò ╫ª╫¿╫ñ╫¬╫Ö", imageSrc: "/images/preferences/culinary/french_bistro.png" },
  { value: "indian", label: "╫ö╫ò╫ô╫Ö", imageSrc: "/images/preferences/culinary/indian.png" },
  { value: "mediterranean", label: "╫Ö╫¥╓╛╫¬╫Ö╫¢╫ò╫á╫Ö", imageSrc: "/images/preferences/culinary/mediterranean.png" },
  { value: "seafood", label: "╫ô╫Æ╫Ö╫¥ ╫ò╫ñ╫Ö╫¿╫ò╫¬ ╫Ö╫¥", imageSrc: "/images/preferences/culinary/seafood.png" },
  { value: "pizza", label: "╫ñ╫Ö╫ª╫ö", imageSrc: "/images/preferences/culinary/pizza.png" },
  { value: "breakfast_brunch", label: "╫É╫¿╫ò╫ù╫¬ ╫æ╫ò╫º╫¿ ╫ò╫æ╫¿╫É╫á╫Ñ'", imageSrc: "/images/preferences/culinary/breakfast_brunch.png" },
  { value: "cafe", label: "╫æ╫Ö╫¬ ╫º╫ñ╫ö", imageSrc: "/images/preferences/culinary/cafe.png" },
  { value: "fine_dining", label: "╫₧╫í╫ó╫ô╫ò╫¬ ╫⌐╫ú", imageSrc: "/images/preferences/culinary/chef.png" },
  { value: "snacks_sweets", label: "╫₧╫É╫á╫ª'╫Ö╫¥ ╫ò╫₧╫¬╫ò╫º╫Ö╫¥", imageSrc: "/images/preferences/culinary/snacks_sweets.png" },
];

export const DIETARY_RESTRICTIONS: PreferenceOption[] = [
  { value: "vegetarian", label: "╫ª╫₧╫ù╫ò╫á╫Ö" },
  { value: "vegan", label: "╫ÿ╫æ╫ó╫ò╫á╫Ö" },
  // "╫¢╫⌐╫¿" - ╫ö╫ò╫ó╫æ╫¿ ╫£╫¢╫É╫ƒ (╫£╫í╫º╫ÿ╫ò╫¿ ╫ö╫₧╫û╫ò╫ƒ) ╫æ╫₧╫º╫ò╫¥ ╫⌐╫É╫£╫¬ toggle ╫á╫ñ╫¿╫ô╫¬. ╫ö╫⌐╫ô╫ö
  // ╫æ-DB/╫æ╫ñ╫¿╫ò╫ñ╫Ö╫£ ╫ó╫ô╫Ö╫Ö╫ƒ boolean ╫á╫ñ╫¿╫ô (kosher) - page.tsx ╫₧╫₧╫ñ╫ö ╫É╫¬ ╫ö╫ª'╫Ö╫ñ ╫ö╫û╫ö
  // ╫É╫£╫Ö╫ò ╫æ╫₧╫Ö╫ò╫ù╫ô, ╫¢╫ô╫Ö ╫£╫É ╫£╫⌐╫æ╫ò╫¿ ╫É╫¬ ╫¢╫£ ╫ö╫º╫ò╫ô ╫ö╫¿╫ù╫æ ╫⌐╫¢╫æ╫¿ ╫º╫ò╫¿╫É dna.kosher/profile.kosher.
  { value: "kosher", label: "╫¢╫⌐╫¿", imageSrc: "/images/preferences/culinary/kosher.png" },
];

export const TRANSPORTATION: PreferenceOption[] = [
  { value: "private_car", label: "╫¿╫¢╫æ ╫ñ╫¿╫ÿ╫Ö" },
  { value: "public_transport", label: "╫¬╫ù╫æ╫ò╫¿╫ö ╫ª╫Ö╫æ╫ò╫¿╫Ö╫¬" },
  { value: "bicycle", label: "╫É╫ò╫ñ╫á╫Ö╫Ö╫¥" },
  { value: "motorcycle", label: "╫É╫ò╫ñ╫á╫ò╫ó" },
  { value: "walking", label: "╫ö╫£╫Ö╫¢╫ö ╫æ╫¿╫Æ╫£" },
];

export const INTERESTS: PreferenceOption[] = [
  { value: "nature_landscapes", label: "╫ÿ╫æ╫ó ╫ò╫á╫ò╫ñ╫Ö╫¥" },
  { value: "springs_streams", label: "╫₧╫ó╫Ö╫Ö╫á╫ò╫¬ ╫ò╫á╫ù╫£╫Ö╫¥" },
  { value: "beaches_pools", label: "╫ù╫ò╫ñ╫Ö ╫Ö╫¥ ╫ò╫æ╫¿╫Ö╫¢╫ò╫¬" },
  { value: "museums_history", label: "╫₧╫ò╫û╫Ö╫É╫ò╫á╫Ö╫¥ ╫ò╫ö╫Ö╫í╫ÿ╫ò╫¿╫Ö╫ö" },
  { value: "culture_art", label: "╫¬╫¿╫æ╫ò╫¬ ╫ò╫É╫₧╫á╫ò╫¬" },
  { value: "coffee_carts_cafes", label: "╫ó╫Æ╫£╫ò╫¬ ╫º╫ñ╫ö ╫ò╫æ╫¬╫Ö ╫º╫ñ╫ö" },
  { value: "restaurants_culinary", label: "╫₧╫í╫ó╫ô╫ò╫¬ ╫ò╫º╫ò╫£╫Ö╫á╫¿╫Ö╫ö" },
  { value: "wineries_breweries", label: "╫Ö╫º╫æ╫Ö╫¥ ╫ò╫₧╫æ╫⌐╫£╫ò╫¬" },
  { value: "shopping", label: "╫⌐╫ò╫ñ╫Ö╫á╫Æ ╫ò╫º╫á╫Ö╫ò╫¬" },
  { value: "amusement_water_parks", label: "╫ñ╫É╫¿╫º╫Ö ╫⌐╫ó╫⌐╫ò╫ó╫Ö╫¥ ╫ò╫₧╫Ö╫¥" },
  { value: "water_attractions", label: "╫É╫ÿ╫¿╫º╫ª╫Ö╫ò╫¬ ╫₧╫Ö╫¥" },
  { value: "sports_extreme", label: "╫í╫ñ╫ò╫¿╫ÿ ╫ò╫É╫º╫í╫ÿ╫¿╫Ö╫¥" },
  { value: "relaxation_spa", label: "╫¿╫ò╫Æ╫ó ╫ò╫í╫ñ╫É" },
  { value: "nightlife", label: "╫ù╫Ö╫Ö ╫£╫Ö╫£╫ö ╫ò╫æ╫Ö╫£╫ò╫Ö╫Ö╫¥" },
  { value: "live_shows", label: "╫ö╫ò╫ñ╫ó╫ò╫¬ ╫ù╫Ö╫ò╫¬" },
  { value: "events_festivals", label: "╫É╫Ö╫¿╫ò╫ó╫Ö╫¥ ╫ò╫ñ╫í╫ÿ╫Ö╫æ╫£╫Ö╫¥" },
];

export const ACCOMMODATION_TYPES: PreferenceOption[] = [
  { value: "hotel", label: "╫₧╫£╫ò╫ƒ", imageSrc: "/images/preferences/accommodation/hotel.png" },
  { value: "resort", label: "╫¿╫Ö╫û╫ò╫¿╫ÿ ╫ò╫É╫¬╫¿╫Ö ╫á╫ò╫ñ╫⌐", imageSrc: "/images/preferences/accommodation/resort.png" },
  { value: "apartment", label: "╫ô╫Ö╫¿╫ö", imageSrc: "/images/preferences/accommodation/appartment.png" },
  { value: "cabin", label: "╫ª╫Ö╫₧╫¿", imageSrc: "/images/preferences/accommodation/zimmer.png" },
  { value: "hostel", label: "╫ö╫ò╫í╫ÿ╫£", imageSrc: "/images/preferences/accommodation/hostel.png" },
  { value: "camping", label: "╫º╫₧╫ñ╫Ö╫á╫Æ", imageSrc: "/images/preferences/accommodation/camping.png" },
  { value: "glamping", label: "╫Æ╫£╫₧╫ñ╫Ö╫á╫Æ", imageSrc: "/images/preferences/accommodation/glamping.png" },
  { value: "villa", label: "╫ò╫Ö╫£╫ö", imageSrc: "/images/preferences/accommodation/villa.png" },
];

export const VACATION_PREFERENCES: PreferenceOption[] = [
  { value: "chill_relax", label: "╫æ╫ÿ╫ƒ╓╛╫Æ╫æ ╫ò╫¿╫ò╫Æ╫ó" },
  { value: "nature_adventure", label: "╫ÿ╫æ╫ó ╫ò╫ö╫¿╫ñ╫¬╫º╫É╫ò╫¬" },
  { value: "urban_city_trip", label: "╫ÿ╫Ö╫ò╫£ ╫É╫ò╫¿╫æ╫á╫Ö ╫æ╫ó╫Ö╫¿ ╫ö╫Æ╫ô╫ò╫£╫ö" },
  { value: "shopping", label: "╫⌐╫ò╫ñ╫Ö╫á╫Æ ╫ò╫º╫á╫Ö╫ò╫¬" },
  { value: "culinary_restaurants", label: "╫º╫ò╫£╫Ö╫á╫¿╫Ö╫ö ╫ò╫₧╫í╫ó╫ô╫ò╫¬" },
  { value: "museums_history", label: "╫₧╫ò╫û╫Ö╫É╫ò╫á╫Ö╫¥ ╫ò╫ö╫Ö╫í╫ÿ╫ò╫¿╫Ö╫ö" },
  { value: "culture_art", label: "╫¬╫¿╫æ╫ò╫¬ ╫ò╫É╫₧╫á╫ò╫¬" },
  { value: "family", label: "╫₧╫⌐╫ñ╫ù╫¬╫Ö" },
  { value: "nightlife", label: "╫ù╫Ö╫Ö ╫£╫Ö╫£╫ö ╫ò╫æ╫Ö╫£╫ò╫Ö╫Ö╫¥" },
  { value: "sports_extreme", label: "╫í╫ñ╫ò╫¿╫ÿ ╫ò╫É╫º╫í╫ÿ╫¿╫Ö╫¥" },
  { value: "spa_wellness", label: "╫í╫ñ╫É ╫ò╫ò╫ò╫£╫á╫í" },
  { value: "ski", label: "╫í╫º╫Ö" },
];
