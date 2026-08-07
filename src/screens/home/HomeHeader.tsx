"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { listAddresses, type UserAddress } from "@/services/addresses/addressesService";
import { ChooseLocationSheet } from "./ChooseLocationSheet";

interface HomeHeaderProps {
  avatarUrl?: string | null;
  loading: boolean;
}

/** Header שקוף שיושב מעל אזור ה-Hero. */
export function HomeHeader({ avatarUrl, loading }: HomeHeaderProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    listAddresses(supabase, user.id)
      .then((addresses) => {
        const active = addresses.find((a) => a.is_default) ?? addresses[0];
        if (active) setSelectedAddress(active);
      })
      .catch(() => {});
  }, [user]);

  return (
    <header className="relative z-10 grid grid-cols-[40px_1fr_40px] items-center px-5 pt-3 pb-0">
      <Link
        href="/profile"
        className="h-10 w-10 overflow-hidden rounded-full border-2 border-[var(--color-primary-start)] bg-bg"
      >
        {loading ? (
          <Skeleton className="h-full w-full rounded-full" />
        ) : avatarUrl ? (
          <img
            src={avatarUrl}
            alt="הפרופיל שלי"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-secondary">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </div>
        )}
      </Link>

      <button
        type="button"
        onClick={() => setLocationSheetOpen(true)}
        className="flex items-center justify-center gap-1 truncate text-sm font-medium text-ink"
      >
        <Image src="/icons/location.png" alt="" width={22} height={22} />
        {selectedAddress ? selectedAddress.label : "המיקום שלי"}
      </button>

      <button
        type="button"
        onClick={() => setMessage("בקרוב - התראות")}
        aria-label="התראות"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-secondary/15 bg-white/70 backdrop-blur-sm"
      >
        <Image src="/icons/bell.png" alt="" width={22} height={22} />
      </button>

      {message && (
        <div className="absolute inset-x-5 top-16 rounded-card bg-ink px-4 py-2 text-center text-xs text-white shadow-soft">
          {message}
        </div>
      )}

      {locationSheetOpen && (
        <ChooseLocationSheet
          onClose={() => setLocationSheetOpen(false)}
          onSelect={(address) => {
            setSelectedAddress(address);
            setLocationSheetOpen(false);
          }}
        />
      )}
    </header>
  );
}