export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  avatarEmoji: string;
  plan: "free" | "premium" | "pro";
  status: "active" | "blocked";
  signupDate: string;
  lastLogin: string;
  tripsCount: number;
  tripMatchSwipes: number;
  favoriteTripTypes: string[];
  travelDna: string;
  interests: string[];
  avgBudget: string;
  favoriteCountries: string[];
  favoriteCities: string[];
  lastTrip: string;
  recentSearches: string[];
  signupSource: string;
  city: string;
  country: string;
}

const NAMES = ["נועה כהן", "איתי לוי", "מיה אברהם", "דניאל פרץ", "שירה מזרחי", "יובל גולן", "טל שפירא", "רותם דגן", "עידו ברק", "אור סבן"];
const DNA = ["חוקר תרבותי", "אוהב טבע", "צייד קולינרי", "מרפתקן אקסטרים", "מטייל רגוע"];
const COUNTRIES = ["יוון", "איטליה", "ספרד", "צרפת", "פורטוגל"];
const CITIES = ["אתונה", "רומא", "ברצלונה", "פריז", "ליסבון"];
const TRIP_TYPES = ["טיול יומי", "חופשה בחו\"ל", "סופ\"ש זוגי", "טיול בטבע", "חיי לילה"];
const INTERESTS = ["קולינריה", "היסטוריה", "טבע", "חיי לילה", "אמנות", "שופינג"];

function seededPick<T>(arr: T[], seed: number) {
  return arr[seed % arr.length];
}

export function getSampleUsers(count = 48): AdminUser[] {
  // TODO: להחליף בשאילתת Supabase אמיתית מול טבלת profiles + preferences.
  return Array.from({ length: count }).map((_, i) => {
    const name = seededPick(NAMES, i) + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : "");
    const plan: AdminUser["plan"] = i % 11 === 0 ? "pro" : i % 4 === 0 ? "premium" : "free";
    const status: AdminUser["status"] = i % 17 === 0 ? "blocked" : "active";
    return {
      id: `usr_${1000 + i}`,
      fullName: name,
      email: `user${i + 1}@example.com`,
      avatarEmoji: ["🙂", "😎", "🧑", "👩", "🧔"][i % 5],
      plan,
      status,
      signupDate: new Date(Date.now() - i * 3 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      lastLogin: new Date(Date.now() - (i % 9) * 24 * 3600 * 1000).toISOString().slice(0, 10),
      tripsCount: (i * 7) % 22,
      tripMatchSwipes: (i * 31) % 400,
      favoriteTripTypes: [seededPick(TRIP_TYPES, i), seededPick(TRIP_TYPES, i + 2)],
      travelDna: seededPick(DNA, i),
      interests: [seededPick(INTERESTS, i), seededPick(INTERESTS, i + 1), seededPick(INTERESTS, i + 3)],
      avgBudget: ["₪", "₪₪", "₪₪₪"][i % 3],
      favoriteCountries: [seededPick(COUNTRIES, i), seededPick(COUNTRIES, i + 1)],
      favoriteCities: [seededPick(CITIES, i), seededPick(CITIES, i + 2)],
      lastTrip: `${seededPick(TRIP_TYPES, i)} ל${seededPick(CITIES, i)}`,
      recentSearches: [seededPick(CITIES, i), seededPick(CITIES, i + 1), seededPick(COUNTRIES, i)],
      signupSource: ["אורגני", "Instagram", "חבר הביא חבר", "Google Ads"][i % 4],
      city: ["תל אביב", "חיפה", "ירושלים", "באר שבע", "רמת גן"][i % 5],
      country: "ישראל",
    };
  });
}
