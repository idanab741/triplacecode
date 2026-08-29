export interface RealUser {
  id: string;
  email: string;
  fullName: string | null;
  city: string | null;
  country: string | null;
  avatarUrl: string | null;
  age: number | null;
  isAnonymous: boolean;
  isBanned: boolean;
  signupDate: string;
  lastLogin: string | null;
  lastActivity: string | null;
  tripsBuilt: number;
  tripsSaved: number;
  favoriteTripTypes: string[];
  likes: number;
  saves: number;
  interests: string[];
  kosher: boolean;
  accessibility: boolean;
  onboardingCompleted: boolean;
}

export interface UserFilters {
  search: string;
  account: string;
  registration: string;
  activity: string;
  trips: string;
  destination: string;
  interest: string;
  ageMin: string;
  ageMax: string;
}

export const EMPTY_FILTERS: UserFilters = {
  search: "",
  account: "",
  registration: "",
  activity: "",
  trips: "",
  destination: "",
  interest: "",
  ageMin: "",
  ageMax: "",
};

// --- User 360° detail (ר' /api/admin/users/[id]) ---

export interface UserDetail {
  account: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
    city: string | null;
    country: string | null;
    age: number | null;
    isAnonymous: boolean;
    isBanned: boolean;
    bannedUntil: string | null;
    signupDate: string;
    lastLogin: string | null;
    onboarding: { main: boolean; tripmatch: boolean; tripbuilding: boolean; preferences: boolean };
    inviteCode: string | null;
    referredBy: string | null;
  };
  preferences: Record<string, unknown> | null;
  travelDna: { preferred_categories: string[]; disliked_categories: string[] } | null;
  tokens: { balance: number; cycleStart: string } | null;
  tokenTransactions: { id: string; amount: number; type: string; reference_id: string | null; created_at: string }[];
  freeText: { text: string; createdAt: string; screen: string; resultTitle: string | null }[];
  searchHistory: { available: boolean; note: string };
  tripBuilderSessions: {
    id: string;
    tripType: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    destination: string | null;
    isSaved: boolean;
    hasFinalItinerary: boolean;
  }[];
  trips: {
    built: { id: string; tripType: string; destination: string | null; isSaved: boolean; createdAt: string; updatedAt: string }[];
    drafts: { id: string; tripType: string; status: string; createdAt: string; updatedAt: string }[];
  };
  likes: { name: string; category: string | null; city: string | null; country: string | null; placeId: string; createdAt: string }[];
  saves: { name: string; category: string | null; city: string | null; country: string | null; placeId: string; createdAt: string }[];
  tripMatch: {
    sessionsCount: number;
    cardsViewed: number;
    swipeRight: number;
    swipeLeft: number;
    matches: number;
    cities: string[];
    categories: string[];
  };
  trippyAi: {
    resultsCount: number;
    lastUsed: string | null;
    results: { id: string; title: string | null; freeText: string | null; city: string | null; stopsCount: number; createdAt: string }[];
  };
  notifications: {
    total: number;
    unread: number;
    items: { id: string; title: string; description: string; isRead: boolean; publishedAt: string }[];
  };
  support: {
    conversationsCount: number;
    lastStatus: string | null;
    lastConversationId: string | null;
    lastMessage: { message: string; senderType: string; createdAt: string } | null;
  };
  segments: { available: boolean; note: string };
  destinationScores: { destinationId: string; destinationName: string; country: string; score: number; reason: string }[];
  activityTimeline: { id: string; type: string; title: string; subtitle: string; timestamp: string; source: string }[];
}
