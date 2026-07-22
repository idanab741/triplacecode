"use client";

import { ReactNode } from "react";

interface UserBubbleProps {
  children: ReactNode;
  onClick?: () => void;
}

export function UserBubble({ children, onClick }: UserBubbleProps) {
  // תשובות קצרות (טווחי גילאים, מרחקים, תקציב וכו') - לעולם לא ישברו שורה,
  // וממורכזות באמצעות flexbox (לא text-align, כי הוא לא אמין עם תערובת עברית/מספרים).
  const isShort = typeof children === "string" && children.length <= 14;

  return (
    <div className="flex justify-end">
      <div
        onClick={onClick}
        className={`flex max-w-[82%] px-5 py-3.5 ${isShort ? "justify-center" : "justify-start"} ${
          onClick ? "cursor-pointer transition active:scale-95" : ""
        }`}
        style={{
          borderRadius: "18px",
          borderBottomLeftRadius: "5px",
          background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))",
          boxShadow: "0 4px 12px rgba(24,119,242,0.28)",
        }}
      >
        <p
          className="text-[14.5px] font-medium leading-6 text-white"
          style={{
            whiteSpace: isShort ? "nowrap" : "pre-wrap",
            direction: "rtl",
          }}
        >
          {children}
        </p>
      </div>
    </div>
  );
}