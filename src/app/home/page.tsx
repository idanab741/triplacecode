"use client";

/**
 * מסך /home זמני — מציג רק אישור שההתחברות עבדה.
 * מסך הבית האמיתי ייבנה בשלב נפרד.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/services/auth/authService";
import { isProfileComplete } from "@/services/profile/profileService";
import { Button, Screen } from "@/components/ui";

export default function HomePage() {
  const { user, loading, profile, profileLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !profileLoading && user && !isProfileComplete(profile)) {
      router.replace("/profile-setup");
    }
  }, [loading, profileLoading, user, profile, router]);

  async function handleSignOut() {
    if (user) {
      await signOut();
    }
    router.push("/");
  }

  if (loading || profileLoading) {
    return (
      <Screen withBottomNavSpacing={false}>
        <p className="pt-10 text-center text-ink-secondary">טוען...</p>
      </Screen>
    );
  }

  return (
    <Screen withBottomNavSpacing={false}>
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-bold text-ink">{user ? "שלום!" : "שלום, אורח!"}</h1>
        {user && <p className="text-ink-secondary">{user.email}</p>}
        <Button variant="secondary" onClick={handleSignOut}>
          {user ? "התנתקות" : "יציאה"}
        </Button>
      </div>
    </Screen>
  );
}
