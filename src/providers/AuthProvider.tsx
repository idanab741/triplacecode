"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/services/supabase/client";
import { AuthContext } from "@/contexts/AuthContext";
import { getProfile, type Profile } from "@/services/profile/profileService";
import { getPreferences, type UserPreferences } from "@/services/preferences/preferencesService";

/** מספק לכל האפליקציה גישה למשתמש המחובר, ל-session, לפרופיל ולהעדפות שלו. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const data = await getProfile(userId);
    setProfile(data);
    setProfileLoading(false);
  }, []);

  const loadPreferences = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setPreferences(null);
      setPreferencesLoading(false);
      return;
    }
    setPreferencesLoading(true);
    const data = await getPreferences(userId);
    setPreferences(data);
    setPreferencesLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      loadProfile(session?.user?.id);
      loadPreferences(session?.user?.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      loadProfile(session?.user?.id);
      loadPreferences(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile, loadPreferences]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(user?.id);
  }, [loadProfile, user?.id]);

  const refreshPreferences = useCallback(async () => {
    await loadPreferences(user?.id);
  }, [loadPreferences, user?.id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        profile,
        profileLoading,
        refreshProfile,
        preferences,
        preferencesLoading,
        refreshPreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
