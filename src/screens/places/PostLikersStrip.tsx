"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAvatarUrl } from "@/constants/avatar";

interface Liker {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

const MAX_VISIBLE = 5;

/**
 * עיגולים קטנים של תמונות הפרופיל של מי שעשה לייק - מעל שורת הפעולות בכרטיס הפוסט.
 * לחיצה על עיגול מובילה לפרופיל של המשתמש. `refreshKey` משתנה אחרי לייק/ביטול לייק
 * של הצופה כדי לרענן את הרשימה.
 */
export function PostLikersStrip({ postId, likeCount, refreshKey }: { postId: string; likeCount: number; refreshKey: number }) {
  const [likers, setLikers] = useState<Liker[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (likeCount <= 0) {
      setLikers([]);
      setTotal(0);
      return;
    }
    let cancelled = false;
    fetch(`/api/social/posts/${postId}/likers`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setLikers((data.likers ?? []) as Liker[]);
        setTotal(data.total ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // likeCount בכוונה לא ב-deps: הרענון מגיע מ-refreshKey (אחרי שהשרת אישר), לא מעדכון אופטימי.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, refreshKey, likeCount > 0]);

  if (likeCount <= 0 || likers.length === 0) return null;

  const visible = likers.slice(0, MAX_VISIBLE);
  const extra = Math.max(0, total - visible.length);

  return (
    <div className="mt-2 flex items-center" aria-label="מי עשה לייק">
      <div className="flex items-center">
        {visible.map((l, i) => (
          <Link
            key={l.id}
            href={`/places/profile/${l.username ?? l.id}`}
            aria-label={l.fullName ?? l.username ?? "מטייל"}
            className={`block h-6 w-6 overflow-hidden rounded-full bg-bg-secondary ring-2 ring-white ${i > 0 ? "-ms-1.5" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAvatarUrl(l.avatarUrl)} alt="" className="h-full w-full object-cover" />
          </Link>
        ))}
      </div>
      {extra > 0 && <span className="ms-1.5 text-[12px] font-semibold text-ink-secondary">+{extra}</span>}
    </div>
  );
}
