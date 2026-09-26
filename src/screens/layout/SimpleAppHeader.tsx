"use client";
import { TRIPLACE_LOGO_STYLE } from "@/components/ui/triplaceLogo";

import { BackButton } from "@/components/ui";

interface SimpleAppHeaderProps {
  onBack: () => void;
  disabled?: boolean;
  title?: string;
}

export function SimpleAppHeader({ onBack, disabled, title }: SimpleAppHeaderProps) {
  return (
    <header className="safe-top sticky top-0 z-30 w-full border-b border-black/[0.06] bg-white">
      <div className="relative h-16">
        <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
          <span
            role="img"
            aria-label="TRIPLACE"
            className="-my-[7px] block h-[53px] w-[174px] shrink-0 select-none"
            style={TRIPLACE_LOGO_STYLE}
          />
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
