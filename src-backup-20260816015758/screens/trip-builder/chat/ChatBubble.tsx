"use client";

import { ReactNode } from "react";

interface ChatBubbleProps {
  children: ReactNode;
}

export function ChatBubble({ children }: ChatBubbleProps) {
  return (
    <div className="flex justify-start">
      <div
        className="max-w-[82%] bg-white px-4 py-3 shadow-[0_2px_8px_rgba(16,24,40,0.06)]"
        style={{ borderRadius: "18px", borderBottomRightRadius: "5px" }}
      >
        <p className="whitespace-pre-wrap text-[14.5px] leading-6 text-ink">{children}</p>
      </div>
    </div>
  );
}
