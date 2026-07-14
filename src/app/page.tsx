"use client";

/**
 * מצב "אורח" (ללא חשבון) מושבת זמנית: /home דורש כעת התחברות,
 * ואין עדיין מסלול אמיתי לכניסת אורחים. יוחלט בהמשך אם להוסיף
 * כניסת אורח אמיתית (למשל anonymous auth של Supabase) או להסיר את הכפתור.
 */

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function SplashPage() {
  const [guestMessage, setGuestMessage] = useState<string | null>(null);

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <Image
        src="/images/hero-splash.png"
        alt="triplace"
        fill
        priority
        className="object-cover"
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-5 bg-[linear-gradient(0deg,var(--color-bg)_45%,transparent)] px-6 pb-10 pt-28 text-center">
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Button href="/auth" fullWidth>
            בואו נתחיל!
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setGuestMessage("כניסת אורח תהיה זמינה בקרוב")}
          >
            היכנס כאורח
          </Button>
          {guestMessage && <p className="text-sm text-ink-secondary">{guestMessage}</p>}
        </div>

        <Link
          href="/auth?tab=login"
          className="rounded-pill bg-bg px-5 py-2.5 text-sm font-semibold text-accent shadow-soft"
        >
          יש לך כבר חשבון? לחץ כאן
        </Link>
      </div>
    </main>
  );
}
