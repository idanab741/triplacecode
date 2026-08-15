export interface RealUser {
  id: string;
  email: string;
  fullName: string | null;
  city: string | null;
  country: string | null;
  avatarUrl: string | null;
  isAnonymous: boolean;
  signupDate: string;
  lastLogin: string | null;
  tripsBuilt: number;
  tripsSaved: number;
  favoriteTripTypes: string[];
  interests: string[];
  kosher: boolean;
  accessibility: boolean;
  onboardingCompleted: boolean;
}
