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
    <main className="flex min-h-screen flex-1 flex-col bg-bg">
      <div className="w-full px-6 pt-8">
        <Image
          src="/images/hero-splash.png"
          alt="קמע triplace עם מזוודה, מוקף בתמונות יעדי טיול"
          width={800}
          height={800}
          priority
          className="h-auto w-full"
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-10 text-center">
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
