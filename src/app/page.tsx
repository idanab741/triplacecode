"use client";

/**
 * מצב "אורח" (ללא חשבון) מושבת זמנית: /home דורש כעת התחברות,
 * ואין עדיין מסלול אמיתי לכניסת אורחים. יוחלט בהמשך אם להוסיף
 * כניסת אורח אמיתית (למשל anonymous auth של Supabase) או להסיר את הכפתור.
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function SplashPage() {
  const [guestMessage, setGuestMessage] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen flex-1 flex-col bg-bg">
      {/* אזור מקום קבוע לתמונת גיבור/קמע — יתווסף בשלב עתידי, כרגע רק גרדיאנט עדין */}
      <div className="h-72 w-full shrink-0 rounded-b-[40px] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary-start)_14%,var(--color-bg)),var(--color-bg))]" />

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-10 text-center">
        <div>
          <p className="text-sm font-medium tracking-wide text-ink-secondary">
            AI Powered by
          </p>
          <h1 className="bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] bg-clip-text text-5xl font-extrabold text-transparent">
            triplace
          </h1>
        </div>

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

        <Link href="/auth?tab=login" className="text-sm text-accent">
          יש לך כבר חשבון? לחץ כאן
        </Link>
      </div>
    </main>
  );
}
