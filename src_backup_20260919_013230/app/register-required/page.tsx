"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui";

export default function RegisterRequiredPage() {
  return (
    <Suspense>
      <RegisterRequiredContent />
    </Suspense>
  );
}

function RegisterRequiredContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <Image src="/images/lock-hero.png" alt="" width={180} height={180} priority />
      <div>
        <h1 className="text-xl font-bold text-ink">כמעט שם!</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          כדי לבנות מסלול ולשמור אותו, צריך חשבון triplace - זה לוקח פחות מדקה.
        </p>
      </div>

      <div className="flex w-full max-w-xl flex-col gap-3">
        <Button href={from ? `/auth?returnTo=${encodeURIComponent(from)}` : "/auth"} fullWidth>
          הרשמה / התחברות
        </Button>
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="text-sm font-medium text-ink-secondary"
        >
          חזרה לעמוד הבית
        </button>
      </div>
    </div>
  );
}
