"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
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

/** בר ניווט תחתון צף עם אפקט זכוכית (glass), ופס כחול נע שמחליק לכפתור הפעיל. */
export function BottomNav({ items, activeId, onChange }: BottomNavProps) {
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const activeItem = items.find((i) => i.id === activeId);
    if (!activeItem || activeItem.elevated) {
      setIndicator(null);
      return;
    }
    const el = itemRefs.current[activeId];
    if (el) {
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeId, items]);

  return (
    <nav className="fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="relative flex items-end gap-1 rounded-pill border border-white/60 bg-bg/70 p-2 shadow-soft backdrop-blur-xl">
        {indicator && (
          <span
            className="pointer-events-none absolute bottom-2 top-2 z-0 rounded-pill transition-all duration-300 ease-out"
            style={{
              left: indicator.left,
              width: indicator.width,
              background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))",
            }}
          />
        )}

        {items.map((item) => {
          const isActive = item.id === activeId;

          if (item.elevated) {
            const content = (
              <span className="relative -mt-8 flex h-16 w-16 items-center justify-center">
                <span className="ai-ring absolute inset-0 rounded-full" />
                <span className="relative z-10 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-sm font-bold tracking-wide text-white shadow-soft">
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

          const itemClasses = `relative z-10 flex flex-col items-center gap-0.5 rounded-pill px-4 py-2 text-xs font-medium transition-colors ${
            isActive ? "text-white" : "text-ink-secondary hover:text-ink"
          }`;

          const setRef = (el: HTMLAnchorElement | HTMLButtonElement | null) => {
            itemRefs.current[item.id] = el;
          };

          return item.href ? (
            <Link key={item.id} href={item.href} ref={setRef} className={itemClasses}>
              <span className="flex h-6 w-6 items-center justify-center leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ) : (
            <button key={item.id} type="button" ref={setRef} onClick={() => onChange?.(item.id)} className={itemClasses}>
              <span className="flex h-6 w-6 items-center justify-center leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <style jsx global>{`
        .ai-ring {
          background: conic-gradient(
            from 0deg,
            transparent 0%,
            var(--color-primary-start) 35%,
            var(--color-primary-end) 50%,
            transparent 75%
          );
          padding: 3px;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: ai-ring-spin 2.4s linear infinite;
        }
        @keyframes ai-ring-spin {
          to {
            transform: rotate(360deg);
          }
        }
        .ai-orb {
          inset: -25%;
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.55), transparent 45%),
            radial-gradient(circle at 70% 75%, var(--color-primary-end), transparent 55%),
            linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end));
          animation: ai-orb-move 5s ease-in-out infinite, ai-orb-pulse 2.6s ease-in-out infinite;
        }
        @keyframes ai-orb-move {
          0%,
          100% {
            transform: rotate(0deg) scale(1);
          }
          50% {
            transform: rotate(20deg) scale(1.12);
          }
        }
        @keyframes ai-orb-pulse {
          0%,
          100% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(1.18);
          }
        }
      `}</style>
    </nav>
  );
}