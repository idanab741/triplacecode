"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export interface BottomNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** ניווט בפועל. אם לא מועבר, נשען על onChange (שימושי בעמוד ה-design). */
  href?: string;
  /** פריט מורם ובולט (כפתור ה-AI במרכז). */
  elevated?: boolean;
}

interface BottomNavProps {
  items: BottomNavItem[];
  activeId: string;
  onChange?: (id: string) => void;
}

/** בר ניווט תחתון צף עם אפקט זכוכית (glass), מרחף מעל תוכן המסך. */
export function BottomNav({ items, activeId, onChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="flex items-end gap-1 rounded-pill border border-white/60 bg-bg/70 p-2 shadow-soft backdrop-blur-xl">
        {items.map((item) => {
          const isActive = item.id === activeId;

          if (item.elevated) {
            const content = (
              <span className="-mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-2xl text-white shadow-soft">
                {item.icon}
              </span>
            );
            return item.href ? (
              <Link key={item.id} href={item.href} className="flex flex-col items-center px-2">
                {content}
              </Link>
            ) : (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange?.(item.id)}
                className="flex flex-col items-center px-2"
              >
                {content}
              </button>
            );
          }

          const itemClasses = `flex flex-col items-center gap-0.5 rounded-pill px-4 py-2 text-xs font-medium transition-colors ${
            isActive
              ? "bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white"
              : "text-ink-secondary hover:text-ink"
          }`;

          return item.href ? (
            <Link key={item.id} href={item.href} className={itemClasses}>
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ) : (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange?.(item.id)}
              className={itemClasses}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
