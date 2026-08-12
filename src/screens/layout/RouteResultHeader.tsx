"use client";

import Image from "next/image";
import { BackButton } from "@/components/ui";

interface RouteResultHeaderProps {
  onBack: () => void;
  heroSrc: string;
  onSave?: () => void;
  saved?: boolean;
  onShare?: () => void;
}

export function RouteResultHeader({ onBack, heroSrc, onSave, saved, onShare }: RouteResultHeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
      <div className="relative h-16">
        <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
          <Image src="/images/trip-triplace-logo.png" alt="" width={110} height={34} className="object-contain" />
          <BackButton onBack={onBack} />
        </div>

        {(onSave || onShare) && (
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                aria-label="שמירה"
                className="flex h-10 w-10 items-center justify-center text-ink"
              >
                {saved ? (
                  <span className="text-lg text-accent">✓</span>
                ) : (
                  <Image src="/icons/save.png" alt="" width={22} height={22} />
                )}
              </button>
            )}
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                aria-label="שיתוף"
                className="flex h-10 w-10 items-center justify-center text-ink"
              >
                <Image src="/icons/share.png" alt="" width={24} height={24} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative w-full">
        <Image src={heroSrc} alt="" width={800} height={450} priority className="h-auto w-full" />
      </div>
    </header>
  );
}
