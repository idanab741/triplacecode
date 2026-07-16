"use client";

import Image from "next/image";

interface ChatHeaderProps {
  current: number;
  total: number;
}

export function ChatHeader({ current, total }: ChatHeaderProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm">
          <Image src="/images/tripy.png" alt="Tripy" fill className="object-cover" priority />
        </div>
        <p className="min-w-0 flex-1 truncate text-[15px] font-bold leading-tight text-ink">טריפי</p>
      </div>

      {/* progress bar — full width, no side margins */}
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
