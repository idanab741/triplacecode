"use client";

import { useState } from "react";
import { useAdminSecret } from "./AdminAuthContext";

/** אם יש כבר סיסמה שמורה - מציג את הילדים (שאר האדמין) ישר, בלי שום
 *  מסך ביניים. אם אין - מסך כניסה חד-פעמי; אחרי שמוזנת סיסמה נכונה פעם
 *  אחת, היא נשמרת ולא נשאלת שוב (עד שלוחצים "התנתק" באופן מפורש). */
export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const { secret, setSecret } = useAdminSecret();
  const [input, setInput] = useState("");

  if (secret) return <>{children}</>;

  return (
    <div className="flex h-screen w-full items-center justify-center" style={{ background: "var(--admin-bg)" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) setSecret(input.trim());
        }}
        className="flex w-full max-w-sm flex-col gap-4 rounded-[var(--admin-radius-lg)] border p-6"
        style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", boxShadow: "var(--admin-shadow-sm)" }}
      >
        <div>
          <h1 className="text-[17px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            כניסה לאדמין
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--admin-ink-secondary)" }}>
            נדרש פעם אחת בלבד - נשמר במכשיר הזה
          </p>
        </div>
        <input
          type="password"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="סיסמת אדמין"
          className="rounded-[var(--admin-radius-sm)] border px-3 py-2 text-[14px]"
          style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg)", color: "var(--admin-ink)" }}
        />
        <button
          type="submit"
          className="rounded-[var(--admin-radius-sm)] px-3 py-2 text-[14px] font-medium text-white"
          style={{ background: "var(--admin-accent)" }}
        >
          כניסה
        </button>
      </form>
    </div>
  );
}
