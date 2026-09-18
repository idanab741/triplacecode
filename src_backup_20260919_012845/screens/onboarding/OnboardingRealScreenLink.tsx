"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/** עוטף את התצוגה המקדימה של כל מסך ומחבר אותה למסך האמיתי באפליקציה -
 *  לחיצה על האיור/הכרטיס עצמו פותחת את הפיצ'ר האמיתי (לא סתם Mockup).
 *  תג קטן "לצפייה במסך האמיתי" מסביר את זה למשתמש. */
export function OnboardingRealScreenLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group relative block w-full max-w-[340px] active:scale-[0.98]" style={{ transition: "transform 150ms" }}>
      {children}
      <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-pill bg-ink/85 px-3 py-1 text-[10px] font-medium text-white shadow-soft">
        לחצו לצפייה במסך האמיתי
      </span>
    </Link>
  );
}
