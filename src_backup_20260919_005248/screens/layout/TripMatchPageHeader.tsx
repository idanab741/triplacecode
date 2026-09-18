"use client";

import Image from "next/image";
import { BackButton } from "@/components/ui";

interface TripMatchPageHeaderProps {
  onBack: () => void;
  heroSrc?: string;
}

export function TripMatchPageHeader({ onBack, heroSrc }: TripMatchPageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
      <div className="relative h-16">
        <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
          <Image src="/images/trip-tripmatch-logo.png" alt="" width={110} height={34} className="object-contain" />
          <BackButton onBack={onBack} />
        </div>
      </div>

      {heroSrc && (
        <div className="relative w-full">
          <Image src={heroSrc} alt="" width={800} height={450} priority className="h-auto w-full" />
        </div>
      )}
    </header>
  );
}
