"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button, Input, Skeleton } from "@/components/ui";

export default function MyProfileRedirectPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [needsUsername, setNeedsUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch("/api/social/profile/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile?.username) {
          router.replace(`/places/profile/${data.profile.username}`);
        } else {
          setNeedsUsername(true);
        }
      });
  }, [user, router]);

  async function handleSetUsername() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/social/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      router.replace(`/places/profile/${data.username}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !user || !needsUsername) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <h1 className="text-[18px] font-bold text-ink">בוא נבחר לך שם משתמש</h1>
      <p className="text-[13.5px] text-ink-secondary">שם המשתמש שלך ב-place&apos;s - אותיות באנגלית, ספרות וקו תחתון</p>
      <Input value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="username" dir="ltr" />
      {error && <p className="text-[12.5px] text-red-500">{error}</p>}
      <Button fullWidth disabled={submitting} onClick={handleSetUsername}>
        {submitting ? "בודק..." : "המשך"}
      </Button>
    </div>
  );
}
