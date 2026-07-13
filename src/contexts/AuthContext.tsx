"use client";

import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "@/services/profile/profileService";
import type { UserPreferences } from "@/services/preferences/preferencesService";

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  preferences: UserPreferences | null;
  preferencesLoading: boolean;
  refreshPreferences: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  profile: null,
  profileLoading: true,
  refreshProfile: async () => {},
  preferences: null,
  preferencesLoading: true,
  refreshPreferences: async () => {},
});
