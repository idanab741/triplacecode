"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { signInAsGuest, translateAuthError } from "@/services/auth/authService";
import { getPostAuthPath } from "@/services/onboarding/onboardingService";

export default function SplashPage() {
  const router = useRouter();
  const { user, loading, profile, profileLoading } = useAuth();
  const [guestMessage, setGuestMessage] = useState<string | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);

  useEffect(() => {
    if (loading || profileLoading) return;
    if (user) {
      router.replace(getPostAuthPath(profile));
    }
  }, [loading, profileLoading, user, profile, router]);

  async function handleGuestLogin() {
    if (guestLoading) return;
    setGuestMessage(null);
    setGuestLoading(true);
    const { data, error } = await signInAsGuest();
    setGuestLoading(false);

    if (error) {
      setGuestMessage(translateAuthError(error.message));
      return;
    }
    if (data.user) router.push("/home");
  }

  if (loading || profileLoading || user) {
    return <main className="min-h-screen bg-bg" />;
  }

  return (
    <main className="flex min-h-screen flex-1 flex-col bg-bg">
      <Image
        src="/images/hero-splash.png"
        alt="קמע triplace, AI Powered by triplace"
        width={800}
        height={800}
        priority
        className="h-auto w-full"
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-10 text-center">
        <div className="flex w-full max-w-xl flex-col gap-3">
          <Button href="/auth" fullWidth className="!py-2 !text-sm !font-semibold">
            בואו נתחיל!
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={handleGuestLogin}
            disabled={guestLoading}
            className="!py-2 !text-sm !font-semibold"
          >
            {guestLoading ? "נכנס..." : "היכנס כאורח"}
          </Button>
          {guestMessage && <p className="text-sm text-ink-secondary">{guestMessage}</p>}
        </div>

        <p className="text-sm text-ink">
          יש לך כבר חשבון?{" "}
          <Link href="/auth?tab=login" className="font-semibold text-accent">
            לחץ כאן
          </Link>
        </p>
      </div>
    </main>
  );
}
