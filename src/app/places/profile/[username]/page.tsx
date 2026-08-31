"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Skeleton, Button } from "@/components/ui";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { useAuth } from "@/hooks/useAuth";
import type { SocialProfileDto } from "@/services/social/socialProfileService";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "שגיאה");
  }
  return res.json();
}

export default function SocialProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<SocialProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchJson<{ profile: SocialProfileDto }>(`/api/social/profile/${username}`)
      .then((r) => setProfile(r.profile))
      .catch((err) => setError(err.message));
  }, [username]);

  async function handleFollowToggle() {
    if (!profile) return;
    setBusy(true);
    try {
      if (profile.viewerState.following) {
        await fetchJson(`/api/social/follows?userId=${profile.id}`, { method: "DELETE" });
      } else {
        await fetchJson("/api/social/follows", { method: "POST", body: JSON.stringify({ userId: profile.id }) });
      }
      setProfile((p) => (p ? { ...p, viewerState: { ...p.viewerState, following: !p.viewerState.following } } : p));
    } finally {
      setBusy(false);
    }
  }

  async function handleFriendAction() {
    if (!profile) return;
    setBusy(true);
    try {
      if (profile.viewerState.friendStatus === "none") {
        await fetchJson("/api/social/friends", { method: "POST", body: JSON.stringify({ userId: profile.id }) });
        setProfile((p) => (p ? { ...p, viewerState: { ...p.viewerState, friendStatus: "pending", isRequester: true } } : p));
      } else if (profile.viewerState.friendStatus === "pending" && profile.viewerState.isRequester) {
        await fetchJson(`/api/social/friends?id=${profile.viewerState.friendshipId}&mode=cancel`, { method: "DELETE" });
        setProfile((p) => (p ? { ...p, viewerState: { ...p.viewerState, friendStatus: "none", friendshipId: null } } : p));
      } else if (profile.viewerState.friendStatus === "accepted") {
        await fetchJson(`/api/social/friends?id=${profile.viewerState.friendshipId}&mode=remove`, { method: "DELETE" });
        setProfile((p) => (p ? { ...p, viewerState: { ...p.viewerState, friendStatus: "none", friendshipId: null } } : p));
      }
    } finally {
      setBusy(false);
    }
  }

  if (error) return <PlacesEmptyState title={error} />;

  if (!profile) {
    return (
      <div className="p-4">
        <Skeleton className="mb-4 h-32 w-full" />
        <Skeleton className="h-6 w-40" />
      </div>
    );
  }

  const friendLabel =
    profile.viewerState.friendStatus === "accepted"
      ? "חברים"
      : profile.viewerState.friendStatus === "pending"
        ? profile.viewerState.isRequester
          ? "בקשה נשלחה"
          : "אשר בקשה"
        : "הוסף חבר";

  return (
    <div className="min-h-screen bg-white pb-10">
      <PlacesHeader onBack={() => router.back()} />

      <div className="h-28 w-full bg-bg-secondary">
        {profile.coverUrl && <Image src={profile.coverUrl} alt="" width={800} height={200} className="h-full w-full object-cover" />}
      </div>

      <div className="px-4">
        <div className="-mt-10 flex items-end justify-between">
          <span className="h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-bg-secondary">
            {profile.avatarUrl ? (
              <Image src={profile.avatarUrl} alt="" width={80} height={80} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-ink-secondary">
                {profile.fullName?.[0] ?? "?"}
              </span>
            )}
          </span>

          {!profile.viewerState.isSelf && (
            <div className="flex gap-2 pb-1">
              <button
                type="button"
                disabled={busy}
                onClick={handleFriendAction}
                className="rounded-pill px-3.5 py-1.5 text-[12.5px] font-bold disabled:opacity-50"
                style={{ border: "1px solid var(--color-places-purple)", color: "var(--color-places-purple)" }}
              >
                {friendLabel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleFollowToggle}
                className="rounded-pill px-3.5 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50"
                style={{ background: "var(--color-places-purple)" }}
              >
                {profile.viewerState.following ? "עוקב" : "עקוב"}
              </button>
            </div>
          )}
          {profile.viewerState.isSelf && (
            <div className="pb-1">
              <Button variant="secondary" onClick={() => router.push("/places/settings")}>
                עריכת פרופיל
              </Button>
            </div>
          )}
        </div>

        <h2 className="mt-3 text-[17px] font-bold text-ink">
          {profile.fullName}
          {profile.isCreator && (
            <span className="ms-1" style={{ color: "var(--color-places-purple)" }}>
              ✓
            </span>
          )}
        </h2>
        {profile.username && <p className="text-[13px] text-ink-secondary">@{profile.username}</p>}
        {profile.bio && <p className="mt-2 text-[13.5px] text-ink">{profile.bio}</p>}

        <div className="mt-4 flex gap-5 border-y border-ink-secondary/10 py-3 text-center">
          <div className="flex-1">
            <div className="text-[15px] font-bold text-ink">{profile.counts.followers}</div>
            <div className="text-[11.5px] text-ink-secondary">עוקבים</div>
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-ink">{profile.counts.following}</div>
            <div className="text-[11.5px] text-ink-secondary">עוקב</div>
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-ink">{profile.counts.friends}</div>
            <div className="text-[11.5px] text-ink-secondary">חברים</div>
          </div>
        </div>

        {/* Posts/Trips/Places/Reviews/Media tabs (סעיף 16) מתחברים כשיש
            מספיק תוכן אמיתי לכל טאב - Trips/Places/Reviews Social
            מתווספים בשלבים 2-3. Posts כבר אפשר להציג כאן ישירות מ-Feed
            מסונן לפי author, כתוספת בלתי-תלויה בהמשך מיידי. */}
      </div>
    </div>
  );
}
