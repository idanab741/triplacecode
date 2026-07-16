"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export interface BottomNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  elevated?: boolean;
}

interface BottomNavProps {
  items: BottomNavItem[];
  activeId: string;
  onChange?: (id: string) => void;
}

/** בר ניווט תחתון קבוע, לבן ומתוח לכל רוחב/עד תחתית המסך, עם כפתור AI מוגבה ומיוחד במרכז. */
export function BottomNav({ items, activeId, onChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50">
      <div className="relative flex items-center justify-around bg-white px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 shadow-[0_-2px_16px_rgba(16,24,40,0.08)]">
        {items.map((item) => {
          const isActive = item.id === activeId;

          if (item.elevated) {
            const content = (
              <span className="relative -mt-8 flex h-[70px] w-[70px] items-center justify-center">
                <span className="ai-glow absolute inset-0 rounded-full" />
                <span className="ai-ring absolute inset-[3px] rounded-full" />
                <span className="relative z-10 flex h-[56px] w-[56px] items-center justify-center overflow-hidden rounded-full text-base font-bold tracking-wide text-white shadow-[0_6px_18px_rgba(24,119,242,0.4)]">
                  <span className="ai-orb absolute" />
                  <span className="relative z-10">{item.icon}</span>
                </span>
              </span>
            );
            return item.href ? (
              <Link key={item.id} href={item.href} className="relative z-10 flex flex-col items-center px-2">
                {content}
              </Link>
            ) : (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange?.(item.id)}
                className="relative z-10 flex flex-col items-center px-2"
              >
                {content}
              </button>
            );
          }

          const itemClasses = "flex flex-col items-center gap-px px-3 py-1 text-xs font-medium transition-colors";

          return item.href ? (
            <Link key={item.id} href={item.href} className={itemClasses}>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full leading-none"
                style={isActive ? { background: "rgba(24,119,242,0.12)" } : undefined}
              >
                <span className="flex h-7 w-7 items-center justify-center">{item.icon}</span>
              </span>
              <span style={isActive ? { color: "var(--color-primary-start)" } : { color: "var(--color-ink-secondary, #8a94a6)" }}>
                {item.label}
              </span>
            </Link>
          ) : (
            <button key={item.id} type="button" onClick={() => onChange?.(item.id)} className={itemClasses}>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full leading-none"
                style={isActive ? { background: "rgba(24,119,242,0.12)" } : undefined}
              >
                <span className="flex h-7 w-7 items-center justify-center">{item.icon}</span>
              </span>
              <span style={isActive ? { color: "var(--color-primary-start)" } : { color: "var(--color-ink-secondary, #8a94a6)" }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <style jsx global>{`
        .ai-glow {
          background: radial-gradient(circle, rgba(24, 119, 242, 0.35), transparent 70%);
          filter: blur(6px);
          animation: ai-glow-pulse 2.6s ease-in-out infinite;
        }
        @keyframes ai-glow-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        .ai-ring {
          background: conic-gradient(
            from 0deg,
            transparent 0%,
            var(--color-primary-start) 30%,
            var(--color-primary-end) 50%,
            transparent 70%
          );
          padding: 3px;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: ai-ring-spin 2.2s linear infinite;
        }
        @keyframes ai-ring-spin {
          to { transform: rotate(360deg); }
        }
        .ai-orb {
          inset: -25%;
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.55), transparent 45%),
            radial-gradient(circle at 70% 75%, var(--color-primary-end), transparent 55%),
            linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end));
          animation: ai-orb-move 5s ease-in-out infinite, ai-orb-pulse 2.6s ease-in-out infinite;
        }
        @keyframes ai-orb-move {
          0%, 100% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(20deg) scale(1.12); }
        }
        @keyframes ai-orb-pulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.18); }
        }
      `}</style>
    </nav>
  );
}