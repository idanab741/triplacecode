"use client";

import Link from "next/link";
import type { DmMessageDto } from "@/services/social/dmService";

/** כרטיס של תוכן ששותף בצ'אט (פוסט / מקום): תמונה, כותרת, ולחיצה פותחת את התוכן. הערה אופציונלית מעל הכרטיס. */
export function DmSharedCard({ message, isMine }: { message: DmMessageDto; isMine: boolean }) {
  const shared = message.shared;
  if (!shared) return null;

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div className="flex max-w-[82%] flex-col gap-1.5">
        {message.text && (
          <p className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[14px] leading-6 ${isMine ? "bg-places-purple text-white" : "bg-white text-ink shadow-soft"}`}>
            {message.text}
          </p>
        )}
        <Link
          href={shared.href}
          className="flex w-64 max-w-full items-center gap-3 overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-2 shadow-[0_2px_8px_rgba(16,24,40,0.06)] transition active:scale-[0.98]"
        >
          <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-bg-secondary">
            {shared.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shared.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[22px]">{message.kind === "place" ? "📍" : "🖼️"}</span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-[14px] font-bold leading-snug text-ink">{shared.title}</span>
            {shared.subtitle && <span className="mt-0.5 block truncate text-[12px] text-ink-secondary">{shared.subtitle}</span>}
          </span>
        </Link>
      </div>
    </div>
  );
}
