"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { getAvatarUrl } from "@/constants/avatar";

export interface SimpleProfileDto {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
}

export type FollowTab = "followers" | "following";

const TABS: { id: FollowTab; label: string; emptyMessage: string }[] = [
  { id: "followers", label: "עוקבים", emptyMessage: "אין עדיין עוקבים להצגה כאן." },
  { id: "following", label: "במעקב", emptyMessage: "עדיין לא במעקב אחרי אף אחד." },
];

interface UserListPageProps {
  username: string;
  initialTab: FollowTab;
}

/** עוקבים / במעקב של משתמש - שתי לשוניות באותו עמוד (בסגנון "עבורך / חברים" של עמוד הבית), מעבר ביניהן בלי לצאת מהעמוד. */
export function UserListPage({ username, initialTab }: UserListPageProps) {
  const router = useRouter();
  const [tab, setTab] = useState<FollowTab>(initialTab);
  const [lists, setLists] = useState<Partial<Record<FollowTab, SimpleProfileDto[]>>>({});
  const [errors, setErrors] = useState<Partial<Record<FollowTab, string>>>({});

  const users = lists[tab] ?? null;
  const error = errors[tab] ?? null;

  useEffect(() => {
    if (lists[tab] || errors[tab]) return;
    let cancelled = false;
    fetch(`/api/social/profile/${encodeURIComponent(username)}/${tab}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        if (!cancelled) setLists((prev) => ({ ...prev, [tab]: data.users ?? [] }));
      })
      .catch((err) => {
        if (!cancelled) setErrors((prev) => ({ ...prev, [tab]: err.message ?? "שגיאה" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, username]);

  function switchTab(next: FollowTab) {
    if (next === tab) return;
    setTab(next);
    // הכתובת מתעדכנת בלי להוסיף רשומה להיסטוריה - כפתור "חזור" ממשיך להחזיר לפרופיל
    window.history.replaceState(null, "", `/places/profile/${encodeURIComponent(username)}/${next}`);
  }

  const activeIndex = TABS.findIndex((t) => t.id === tab);
  const emptyMessage = TABS[activeIndex].emptyMessage;

  return (
    <div className="min-h-screen bg-white pb-10">
      {/* הבר החדש של triplace (אותו בר כמו בעמוד הפרופיל) - עם כפתור חזור */}
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => router.back()} />

      {/* לשוניות עוקבים / במעקב - אותו סגנון כמו "עבורך / חברים" בעמוד הבית (RTL: הראשונה בימין) */}
      <div role="tablist" aria-label="עוקבים / במעקב" className="relative mt-2 grid grid-cols-2 border-b border-black/[0.08]">
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => switchTab(t.id)}
              className="py-3.5 text-[15px] outline-none transition-colors focus-visible:bg-black/[0.04] active:bg-black/[0.03]"
              style={{ color: selected ? "var(--color-ink)" : "var(--color-ink-secondary, #8a94a6)", fontWeight: selected ? 800 : 600 }}
            >
              {t.label}
            </button>
          );
        })}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 flex w-1/2 justify-center"
          style={{ transform: `translateX(${-activeIndex * 100}%)`, transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <span className="h-[3px] w-14 rounded-full" style={{ background: "var(--color-places-purple)" }} />
        </div>
      </div>

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
