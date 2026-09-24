"use client";

import Image from "next/image";
import { BackButton } from "@/components/ui";

interface SimpleAppHeaderProps {
  onBack: () => void;
  disabled?: boolean;
  title?: string;
}

export function SimpleAppHeader({ onBack, disabled, title }: SimpleAppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
      <div className="relative h-16">
        <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
          <Image src="/images/triplace-logo-black.png" alt="" width={174} height={53} className="-my-[7px] h-[53px] w-[174px] max-w-none object-contain" />
          <BackButton onBack={onBack} disabled={disabled} />
        </div>
        {title && (
          <div className="absolute right-5 top-1/2 flex -translate-y-1/2 items-center">
            <h1 className="text-xl font-bold text-ink">{title}</h1>
          </div>
        )}
      </div>
    </header>
  );
}
