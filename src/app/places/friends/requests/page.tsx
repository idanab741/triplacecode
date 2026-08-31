"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { useAuth } from "@/hooks/useAuth";

interface PendingRequest {
  id: string;
  created_at: string;
  requester: { id: string; username: string | null; full_name: string | null; avatar_url: string | null };
}

export default function FriendRequestsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<PendingRequest[] | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/social/friends?scope=pending")
      .then((r) => r.json())
      .then((data) => setRequests(data.requests ?? []));
  }, [user]);

  async function respond(id: string, response: "accepted" | "declined") {
    await fetch(`/api/social/friends/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    setRequests((prev) => prev?.filter((r) => r.id !== id) ?? null);
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      <PlacesHeader onBack={() => router.back()} />

      {requests === null && (
        <div className="p-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="mb-2 h-16 w-full" />
          ))}
        </div>
      )}

      {requests?.length === 0 && <PlacesEmptyState title="אין בקשות חברות ממתינות" />}

      {requests?.map((req) => (
        <div key={req.id} className="flex items-center gap-3 px-4 py-3">
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
            {req.requester.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={req.requester.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-bold text-ink-secondary">
                {req.requester.full_name?.[0] ?? "?"}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
            {req.requester.full_name ?? req.requester.username}
          </span>
          <button
            type="button"
            onClick={() => respond(req.id, "accepted")}
            className="rounded-pill px-4 py-1.5 text-[12.5px] font-bold text-white"
            style={{ background: "var(--color-places-purple)" }}
          >
            אישור
          </button>
          <button
            type="button"
            onClick={() => respond(req.id, "declined")}
            className="rounded-pill bg-bg-secondary px-4 py-1.5 text-[12.5px] font-bold text-ink-secondary"
          >
            דחייה
          </button>
        </div>
      ))}
    </div>
  );
}
