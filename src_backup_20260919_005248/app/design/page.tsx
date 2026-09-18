"use client";

/**
 * עמוד זה הוא ספריית העיצוב (Design System) הפנימית של TRIPLACE.
 * הוא מציג זה-לצד-זה את כל קומפוננטות הבסיס כדי שנוכל לבדוק ולאשר
 * את השפה העיצובית. נמשיך להשתמש בעמוד הזה לאורך הפיתוח כדי להוסיף
 * ולבדוק קומפוננטות חדשות לפני שהן נכנסות למסכים האמיתיים.
 */

import { useState } from "react";
import { Button, Card, Input, Screen, BottomNav } from "@/components/ui";
import type { BottomNavItem } from "@/components/ui";

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m3 11 9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </svg>
);

const MapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3Z" />
    <path d="M9 7v13M15 4v13" />
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

const navItems: BottomNavItem[] = [
  { id: "home", label: "בית", icon: <HomeIcon /> },
  { id: "map", label: "מפה", icon: <MapIcon /> },
  { id: "profile", label: "פרופיל", icon: <UserIcon /> },
];

const colorSwatches = [
  { name: "primary-start", varName: "--color-primary-start" },
  { name: "primary-end", varName: "--color-primary-end" },
  { name: "bg", varName: "--color-bg" },
  { name: "bg-secondary", varName: "--color-bg-secondary" },
  { name: "ink", varName: "--color-ink" },
  { name: "ink-secondary", varName: "--color-ink-secondary" },
  { name: "accent", varName: "--color-accent" },
];

export default function DesignPage() {
  const [activeNav, setActiveNav] = useState("home");

  return (
    <Screen>
      <div className="mx-auto flex max-w-2xl flex-col gap-10">
        <header>
          <h1 className="text-3xl font-bold text-ink">TRIPLACE Design System</h1>
          <p className="mt-1 text-ink-secondary">
            ספריית העיצוב הפנימית — כל קומפוננטות הבסיס במקום אחד.
          </p>
        </header>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">צבעים (Tokens)</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {colorSwatches.map((c) => (
              <div key={c.name} className="flex flex-col gap-2">
                <div
                  className="h-16 rounded-card border border-ink-secondary/10"
                  style={{ background: `var(${c.varName})` }}
                />
                <span className="text-xs text-ink-secondary">{c.name}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">טיפוגרפיה</h2>
          <Card className="flex flex-col gap-2">
            <p className="text-2xl font-bold text-ink">כותרת גדולה מודגשת</p>
            <p className="text-base text-ink-secondary">תת-כותרת אפורה</p>
            <p className="text-sm text-ink">
              טקסט רץ רגיל בעברית מלאה, לבדיקת קריאות וכיווניות RTL.
            </p>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">כפתורים</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">כפתור ראשי</Button>
            <Button variant="secondary">כפתור משני</Button>
            <Button variant="primary" disabled>
              לא פעיל
            </Button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">שדות קלט</h2>
          <div className="flex flex-col gap-3">
            <Input placeholder="חיפוש..." icon={<SearchIcon />} />
            <Input placeholder="ללא אייקון" />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">כרטיס (Card)</h2>
          <Card>
            <p className="font-semibold text-ink">כותרת הכרטיס</p>
            <p className="mt-1 text-sm text-ink-secondary">
              תוכן לדוגמה בתוך כרטיס עם פינות מעוגלות וצל רך.
            </p>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">Bottom Navigation</h2>
          <p className="text-sm text-ink-secondary">
            הבר הצף מוצג בתחתית העמוד הזה בפועל — זו הדוגמה החיה.
          </p>
        </section>
      </div>

      <BottomNav items={navItems} activeId={activeNav} onChange={setActiveNav} />
    </Screen>
  );
}
