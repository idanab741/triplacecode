"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { useAuth } from "@/hooks/useAuth";
import { formatRelativeTimeHe } from "@/utils/relativeTime";
import type { SocialNotificationItem } from "@/services/social/socialNotificationsService";
import { getAvatarUrl } from "@/constants/avatar";

const TYPE_TEXT: Record<string, string> = {
  NEW_FOLLOWER: "התחיל/ה לעקוב אחריך",
  FRIEND_REQUEST: "שלח/ה לך בקשת חברות",
  FRIEND_ACCEPTED: "אישר/ה את בקשת החברות שלך",
  POST_LIKE: "אהב/ה את הפוסט שלך",
  POST_COMMENT: "הגיב/ה על הפוסט שלך",
  COMMENT_REPLY: "הגיב/ה לתגובה שלך",
};

export default function PlacesNotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<SocialNotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/social/notifications")
      .then((r) => r.json())
      .then((data) => setItems(data.notifications ?? []))
      .catch(() => setError("שגיאה בטעינת ההתראות"));
  }, [user]);

  async function handleClick(item: SocialNotificationItem) {
    fetch("/api/social/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityKey: item.id }),
    }).catch(() => {});

    if (item.type === "FRIEND_REQUEST") {
      router.push("/places/friends/requests");
    } else if (item.type === "POST_LIKE" || item.type === "POST_COMMENT") {
      router.push(`/places/post/${item.targetId}`);
    } else if (item.actor.username) {
      router.push(`/places/profile/${item.actor.username}`);
    }
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      <PlacesHeader onBack={() => router.push("/places")} />

      {items === null && !error && (
        <div className="p-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="mb-2 h-14 w-full" />
          ))}
        </div>
      )}

      {error && <PlacesEmptyState title={error} actionLabel="נסה שוב" onAction={() => location.reload()} />}

      {items?.length === 0 && <PlacesEmptyState title="אין עדיין התראות" />}

      {items && items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleClick(item)}
                className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-bg-secondary"
                style={{ background: item.isRead ? "transparent" : "rgba(159,123,255,0.06)" }}
              >
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getAvatarUrl(item.actor.avatarUrl)} alt="" className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ink">
                    <span className="font-bold">{item.actor.fullName ?? item.actor.username}</span>{" "}
                    {TYPE_TEXT[item.type] ?? ""}
                  </span>
                  <span className="text-[11.5px] text-ink-secondary">{formatRelativeTimeHe(item.createdAt)}</span>
                </span>
                {!item.isRead && (
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--color-places-purple)" }} />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}
