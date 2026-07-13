"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/services/auth/authService";
import { AvatarUploader } from "@/components/AvatarUploader";
import { MainBottomNav } from "@/components/MainBottomNav";
import { Button, Card, Screen, Skeleton } from "@/components/ui";

export default function ProfilePage() {
  const { user, loading, profile, profileLoading } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  if (loading || profileLoading) {
    return (
      <Screen>
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4 pt-6">
          <Skeleton className="h-28 w-28 rounded-full" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-6 pt-6">
        {user && <AvatarUploader userId={user.id} initialUrl={profile?.avatar_url} />}

        <div className="text-center">
          <h1 className="text-xl font-bold text-ink">{profile?.full_name || "המשתמש שלי"}</h1>
          <p className="text-sm text-ink-secondary">{user?.email}</p>
        </div>

        <Card className="w-full">
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-secondary">עיר מגורים</dt>
              <dd className="font-medium text-ink">{profile?.city || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary">מדינה</dt>
              <dd className="font-medium text-ink">{profile?.country || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary">תאריך לידה</dt>
              <dd className="font-medium text-ink">{profile?.birth_date || "—"}</dd>
            </div>
          </dl>
        </Card>

        <Button href="/preferences?returnTo=/profile" variant="secondary" fullWidth>
          עריכת העדפות
        </Button>

        <Button variant="secondary" fullWidth onClick={handleSignOut}>
          התנתקות
        </Button>
      </div>

      <MainBottomNav active="profile" />
    </Screen>
  );
}
