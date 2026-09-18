"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { getAvatarUrl } from "@/constants/avatar";

export interface SimpleProfileDto {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
}

interface UserListPageProps {
  title: string;
  fetchUrl: string;
  emptyMessage: string;
}

/** רשימת משתמשים גנרית - לשימוש גם בעוקבים וגם בעוקב-אחריהם, כדי לא
 *  לשכפל את אותו UI פעמיים (בקשה - "אי אפשר להיכנס לרשימת המעקב?"). */
export function UserListPage({ title, fetchUrl, emptyMessage }: UserListPageProps) {
  const router = useRouter();
  const [users, setUsers] = useState<SimpleProfileDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(fetchUrl)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setUsers(data.users ?? []);
      })
      .catch((err) => setError(err.message ?? "שגיאה"));
  }, [fetchUrl]);

  return (
    <div className="min-h-screen bg-white pb-10">
      <PlacesHeader onBack={() => router.back()} />
      <h1 className="px-4 pt-2 text-[16px] font-bold text-ink">{title}</h1>

      <div className="mt-2 flex flex-col">
        {error && <p className="px-4 py-6 text-center text-[13px] text-ink-secondary">{error}</p>}

        {!error && users === null && (
          <div className="flex flex-col gap-3 px-4 py-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-card" />
            ))}
          </div>
        )}

        {!error && users !== null && users.length === 0 && (
          <p className="px-4 py-10 text-center text-[13px] text-ink-secondary">{emptyMessage}</p>
        )}

        {!error &&
          users !== null &&
          users.map((u) => (
            <Link
              key={u.id}
              href={`/places/profile/${u.username ?? u.id}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-secondary"
            >
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getAvatarUrl(u.avatar_url)} alt="" className="h-full w-full object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-ink">
                  {u.full_name}
                  {u.is_creator && (
                    <span className="ms-1" style={{ color: "var(--color-places-purple)" }}>
                      ✓
                    </span>
                  )}
                </p>
                {u.username && (
                  <p dir="ltr" className="truncate text-end text-[12px] text-ink-secondary">
                    @{u.username}
                  </p>
                )}
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}
