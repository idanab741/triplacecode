"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { CommandPalette } from "./CommandPalette";

const DARK_MODE_KEY = "triplace_admin_dark_mode";

export function AdminShell({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    let initial = false;
    try {
      const stored = window.localStorage.getItem(DARK_MODE_KEY);
      initial = stored === null ? window.matchMedia("(prefers-color-scheme: dark)").matches : stored === "1";
    } catch {
      // localStorage לא זמין - נשארים על light
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(initial);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
    <div dir="rtl" className={`admin-root fixed inset-0 flex ${dark ? "admin-dark" : ""}`}>
      <AdminSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="admin-scrollbar flex min-w-0 flex-1 flex-col overflow-y-auto" style={{ background: "var(--admin-bg)" }}>
        <AdminHeader dark={dark} onToggleDark={toggleDark} onOpenSearch={() => setSearchOpen(true)} onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
