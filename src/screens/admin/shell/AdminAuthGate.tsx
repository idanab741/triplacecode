"use client";

import { useState } from "react";
import { useAdminSecret } from "./AdminAuthContext";
import { Icon } from "@/screens/admin/kit/Icon";

/** כניסה חד-פעמית לאדמין. הסיסמה מאומתת מול השרת לפני שנשמרת -
 *  סיסמה שגויה לא "נכנסת" למערכת ומציגה מסכים ריקים כמו קודם. */
export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const { secret, setSecret } = useAdminSecret();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  if (secret) return <>{children}</>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/verify", { method: "POST", headers: { "x-admin-secret": value } });
      if (res.ok) {
        setSecret(value);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(res.status === 401 ? "סיסמה שגויה" : (body.error ?? "שגיאת שרת"));
    } catch {
      setError("אין חיבור לשרת");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="admin-root fixed inset-0 flex items-center justify-center px-4"
      style={{ background: "radial-gradient(1200px 600px at 70% -10%, #1f3b73 0%, #0c1322 55%, #070b14 100%)" }}
    >
      <form onSubmit={submit} className="admin-fade-in w-full max-w-sm rounded-[var(--admin-radius-xl)] border p-7" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[12px] text-[18px] font-bold text-white" style={{ background: "linear-gradient(135deg, #4a9eff 0%, #1f6fe5 55%, #6a5cff 100%)" }}>
            T
          </span>
          <div>
            <h1 className="text-[18px] font-semibold text-white">TRIPLACE Control Center</h1>
            <p className="text-[13px]" style={{ color: "#93a1bb" }}>
              כניסה לצוות בלבד
            </p>
          </div>
        </div>
        <label className="mb-1.5 block text-[12.5px] font-medium" style={{ color: "#c9d2e3" }} htmlFor="admin-secret">
          סיסמת אדמין
        </label>
        <input
          id="admin-secret"
          type="password"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded-[var(--admin-radius-sm)] border px-3 py-2.5 text-[14px] text-white outline-none focus:border-[#4a9eff]"
          style={{ borderColor: "rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.25)" }}
        />
        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-[12.5px]" style={{ color: "#ff8a8a" }}>
            <Icon name="alertCircle" size={14} />
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={checking || !input.trim()}
          className="mt-5 w-full rounded-[var(--admin-radius-sm)] py-2.5 text-[14px] font-semibold text-white transition disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #3d8bff, #1f6fe5)" }}
        >
          {checking ? "בודק..." : "כניסה"}
        </button>
        <p className="mt-4 text-center text-[11.5px]" style={{ color: "#6f7c95" }}>
          הסיסמה נשמרת במכשיר הזה עד להתנתקות
        </p>
      </form>
    </div>
  );
}
