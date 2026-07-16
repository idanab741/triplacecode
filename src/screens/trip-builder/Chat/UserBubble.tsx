"use client";

import { ReactNode } from "react";

interface UserBubbleProps {
  children: ReactNode;
}

export function UserBubble({ children }: UserBubbleProps) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[82%] px-4 py-3"
        style={{
          borderRadius: "18px",
          borderBottomLeftRadius: "5px",
          background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))",
          boxShadow: "0 4px 12px rgba(24,119,242,0.28)",
        }}
      >
        <p className="whitespace-pre-wrap text-[14.5px] font-medium leading-6 text-white">{children}</p>
      </div>
    </div>
  );
}
