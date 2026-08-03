"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";

const DARK_MODE_KEY = "triplace_admin_dark_mode";

export function AdminShell({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      setDark(window.localStorage.getItem(DARK_MODE_KEY) === "1");
    } catch {
      // localStorage לא זמין - נשארים על light כברירת מחדל
    }
    setMounted(true);
  }, []);

  function toggleDark() {
    setDark((d) => {
      const next = !d;
      try {
        window.localStorage.setItem(DARK_MODE_KEY, next ? "1" : "0");
      } catch {
        // לא קריטי
      }
      return next;
    });
  }

  return (
    <div dir="ltr" className={`admin-root flex h-screen ${mounted && dark ? "admin-dark" : ""}`}>
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader dark={dark} onToggleDark={toggleDark} />
        <main className="admin-scrollbar flex-1 overflow-y-auto p-6" style={{ background: "var(--admin-bg)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
