"use client";

import Image from "next/image";
import { BackButton } from "@/components/ui";

interface TripBuilderHeaderProps {
  current: number;
  total: number;
  onBack?: () => void;
}

/** Header למסכי השאלות של בניית מסלול (7 סוגי טיול) - עיגון פיזי מפורש
 *  (left-2/right-2), לא flex+justify-between, כדי שזה לא יתהפך לפי RTL:
 *  לוגו Triplace + חזור תמיד ב-left הפיזי, אווטאר טריפי + "טריפי AI"
 *  תמיד ב-right הפיזי (הכי ימני בעמוד). אותו לוגו + כפתור חזור בדיוק כמו
 *  ב-SimpleAppHeader (עמוד ההעדפות/סגנון קולינרי) ובעמוד הצ'אט (ChatHeader),
 *  כדי שהבר העליון יהיה זהה בכל האפליקציה. אותו Progress Bar כמו קודם. */
export function TripBuilderHeader({ current, total, onBack }: TripBuilderHeaderProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
      <div className="relative h-16">
        <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
          <Image src="/images/triplace-logo-black.png" alt="" width={110} height={34} className="object-contain" />
          {onBack && <BackButton onBack={onBack} />}
        </div>

        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2 pr-[7px]">
          <div className="relative h-[34px] w-[34px] shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm">
            <Image src="/images/tripy.png" alt="Tripy" fill className="object-cover" priority />
          </div>
          <p className="text-lg font-bold leading-tight text-ink">טריפי AI</p>
        </div>
      </div>

      <div className="h-1.5 w-full bg-ink-secondary/10">
        <div
          className="h-full rounded-l-full transition-all duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--color-primary-start), var(--color-primary-end))",
          }}
        />
      </div>
    </header>
  );
}
