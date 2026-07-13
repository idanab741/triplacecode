"use client";

import { useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui";

interface HomeHeaderProps {
  avatarUrl?: string | null;
  loading: boolean;
}

/** Header שקוף שיושב מעל אזור ה-Hero. */
export function HomeHeader({ avatarUrl, loading }: HomeHeaderProps) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-6">
      <Link
        href="/profile"
        className="h-10 w-10 overflow-hidden rounded-full border-2 border-[var(--color-primary-start)] bg-bg"
      >
        {loading ? (
          <Skeleton className="h-full w-full rounded-full" />
        ) : avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="הפרופיל שלי" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </div>
        )}
      </Link>

      <button
        type="button"
        onClick={() => setMessage("בקרוב אפשר יהיה לבחור מיקום")}
        className="flex items-center gap-1 text-sm font-medium text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s7-6.5 7-12A7 7 0 0 0 5 10c0 5.5 7 12 7 12Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        המיקום שלי
      </button>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setMessage("התראות יגיעו בקרוב")} className="text-ink" aria-label="התראות">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </button>
        <button type="button" onClick={() => setMessage("תפריט נוסף בקרוב")} className="text-ink" aria-label="תפריט">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {message && (
        <div className="absolute inset-x-5 top-14 rounded-card bg-ink px-4 py-2 text-center text-xs text-white shadow-soft">
          {message}
        </div>
      )}
    </header>
  );
}
