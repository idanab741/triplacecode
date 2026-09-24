"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AiGlobeIcon } from "./AiGlobeIcon";

export interface BottomNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  /** הפריט המרכזי (tripmatch) - מוצג עם הגלובוס המסתובב במקום אייקון רגיל. */
  elevated?: boolean;
  /** רק לפריט elevated: מחליף את AiGlobeIcon בתוכן חופשי. */
  elevatedIcon?: ReactNode;
  /** צבע הטקסט (והגוון של "הגלולה" מאחוריו) כשהפריט פעיל. */
  activeColor?: string;
}

interface BottomNavProps {
  items: BottomNavItem[];
  activeId: string;
  onChange?: (id: string) => void;
  /** "dark" = זכוכית כהה עם תוויות לבנות (עמוד "תוכן"). */
  tone?: "light" | "dark";
}

/**
 * *** בנוי מחדש (בקשה מפורשת - "שהבר התחתון יצוף כמו בסגנון החדש של אפל, עם תזוזה אנימטיבית של
 * האייקונים כמו בפייסבוק"): אותן אפשרויות בדיוק, בעיצוב של iOS החדש (Liquid Glass):
 *  - גלולה צפה עם שוליים מהצדדים ומלמטה, זכוכית חלבית שקופה-למחצה (backdrop-filter) - התוכן נראה
 *    מאחוריה בעדינות.
 *  - "גלולה" פנימית מאחורי הטאב הפעיל, שמחליקה בקפיצה רכה (spring) מהטאב הקודם לחדש, ומתמתחת
 *    לרגע בזמן התנועה - כמו טיפת נוזל.
 *  - האייקון "קופץ" בלחיצה (מתכווץ ואז עולה מעט מעבר לגודלו וחוזר) - כמו בפייסבוק.
 *
 * כל עמוד מרנדר את הבר מחדש, לכן הטאב האחרון נשמר ברמת המודול (lastActiveId) - כך שבכניסה לעמוד
 * חדש הגלולה מתחילה מהטאב הקודם ומחליקה לחדש, במקום "לקפוץ" אליו.
 *
 * גאומטריה: הבר תופס בדיוק את אותו גובה כמו הבר הקודם (לא יותר) - כל הריווחים הקיימים באפליקציה
 * (BottomSheet mb-[88px], גובה המפה, ריווח עמוד tripmatch) נשארים נכונים בלי לגעת בהם.
 */

let lastActiveId: string | null = null;

const EASE_SPRING = "cubic-bezier(0.34, 1.36, 0.5, 1)";

export function BottomNav({ items, activeId, onChange, tone = "light" }: BottomNavProps) {
  const dark = tone === "dark";
  const count = items.length;
  const activeIndex = Math.max(0, items.findIndex((i) => i.id === activeId));

  // מיקום הגלולה: מתחילים מהטאב הקודם (אם הגענו מעמוד אחר) ומחליקים לנוכחי בפריים הבא.
  const [indicatorIndex, setIndicatorIndex] = useState(() => {
    const prev = lastActiveId ? items.findIndex((i) => i.id === lastActiveId) : -1;
    return prev >= 0 ? prev : activeIndex;
  });
  const [animateIndicator, setAnimateIndicator] = useState(false);
  const [stretchKey, setStretchKey] = useState(0);
  /** *** שונה (בקשה מפורשת - "לא אוהב את הקפיצה של הלוגו; מה שצריך לקפוץ זה השורה עצמה של הבר"):
   *  במקום שהאייקון יקפוץ - כל הבר מגיב כיחידה אחת: מתכווץ קלות בלחיצה וחוזר בתנועה אלסטית. */
  const [bounceKey, setBounceKey] = useState(0);
  const mountedRef = useRef(false);
  const barRef = useRef<HTMLDivElement | null>(null);

  // מפעיל מחדש את אנימציית הבר בלי לרנדר אותו מחדש (כדי לא לאפס את הגלובוס המסתובב ואת תנועת הגלולה).
  useEffect(() => {
    const el = barRef.current;
    if (!el || bounceKey === 0) return;
    el.classList.remove("tab-bar-bounce");
    void el.offsetWidth; // reflow - מאפשר להפעיל את אותה אנימציה שוב
    el.classList.add("tab-bar-bounce");
    // רק סוף האנימציה של הבר עצמו - animationend מבועבע גם מהגלולה/הגלובוס שבתוכו.
    const done = (e: AnimationEvent) => {
      if (e.target === el && e.animationName === "tab-bar-bounce") el.classList.remove("tab-bar-bounce");
    };
    el.addEventListener("animationend", done);
    return () => el.removeEventListener("animationend", done);
  }, [bounceKey]);

  useLayoutEffect(() => {
    const cameFromOtherTab = !mountedRef.current && indicatorIndex !== activeIndex;
    mountedRef.current = true;
    lastActiveId = activeId;
    if (indicatorIndex === activeIndex) return;
    // פריים אחד במיקום הקודם (בלי מעבר), ואז מעבר קפיצי למיקום החדש.
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimateIndicator(true);
        setIndicatorIndex(activeIndex);
        setStretchKey((k) => k + 1);
        // כל עמוד מרנדר את הבר מחדש - לכן הבר החדש הוא זה שמגיב כשמגיעים מטאב אחר.
        if (cameFromOtherTab) setBounceKey((k) => k + 1);
      })
    );
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, activeId]);

  function handleTap(item: BottomNavItem) {
    setBounceKey((k) => k + 1);
    if (item.id !== activeId) lastActiveId = activeId;
    onChange?.(item.id);
  }

  const activeItem = items[indicatorIndex] ?? items[activeIndex];
  const tint = dark
    ? "rgba(255,255,255,0.16)"
    : activeItem?.activeColor
      ? `color-mix(in srgb, ${activeItem.activeColor} 13%, transparent)`
      : "rgba(15,20,25,0.07)";

  return (
    <nav aria-label="ניווט ראשי" className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
      <div
        data-main-bottom-nav=""
        dir="rtl"
        ref={barRef}
        className={`tab-glass pointer-events-auto relative mx-auto flex h-[58px] items-stretch rounded-[29px] p-1.5 ${dark ? "tab-glass--dark" : ""}`}
        style={{
          width: "calc(100% - 24px)",
          maxWidth: 460,
          marginBottom: "calc(max(env(safe-area-inset-bottom), 22px) + 2px)",
        }}
      >
        {/* הגלולה הפעילה - מחליקה בין הטאבים */}
        <span
          aria-hidden="true"
          className="tab-indicator pointer-events-none absolute bottom-1.5 top-1.5"
          style={{
            right: 6,
            width: `calc((100% - 12px) / ${count})`,
            transform: `translateX(${-indicatorIndex * 100}%)`,
            transition: animateIndicator ? `transform 560ms ${EASE_SPRING}` : "none",
          }}
        >
          <span
            key={stretchKey}
            className={`block h-full w-full rounded-[23px] ${stretchKey > 0 ? "tab-indicator-stretch" : ""}`}
            style={{ background: tint, transition: "background-color 300ms ease" }}
          />
        </span>

        {items.map((item) => {
          const isActive = item.id === activeId;

          // *** תוקן (בקשה מפורשת - "האייקון של tripmatch באיכות לא טובה, שיהיה כמו מקודם וגדול יותר"):
          // הגלובוס מצויר מנקודות - ב-34px הנקודות התמזגו לכתם. חזר לגודל המקורי (56px) עם הטבעת
          // המסתובבת וההילה, ובולט מעל הגלולה באמצע הבר - בדיוק כמו בבר הקודם.
          const icon = item.elevated ? (
            <span className="relative -mt-[26px] flex h-[64px] w-[64px] shrink-0 items-center justify-center">
              {item.elevatedIcon ? (
                <span className="relative z-10 flex h-[56px] w-[56px] items-center justify-center overflow-hidden rounded-full">{item.elevatedIcon}</span>
              ) : (
                <>
                  <span className="tab-ai-glow absolute -inset-1 rounded-full" style={isActive ? undefined : { opacity: 0 }} />
                  <span
                    className="tab-ai-ring absolute inset-0 rounded-full"
                    style={isActive ? undefined : { background: "conic-gradient(from 0deg, transparent 0%, #0f1522 30%, #3a4150 50%, transparent 70%)" }}
                  />
                  <span className="relative z-10 flex h-[56px] w-[56px] items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_6px_18px_rgba(24,119,242,0.4)]">
                    <AiGlobeIcon active={isActive} size={56} />
                  </span>
                </>
              )}
            </span>
          ) : (
            <span className="flex h-7 w-7 items-center justify-center">{item.icon}</span>
          );

          // *** בקשה מפורשת ("שלא יהיה את הטקסט בתחתית האייקון"): אייקונים בלבד. השם נשאר כ-aria-label
          // לקוראי מסך. הגלובוס נצמד לראש הטאב (items-start) ובולט 20px מעל הבר - מרכזו 12px מתחת לראש
          // הבר, בדיוק כמו קודם, כך שהחצי-עיגול בכרטיס של tripmatch ממשיך להתאים לו.
          const inner = (
            <span className={`flex h-full w-full justify-center ${item.elevated ? "items-start" : "items-center"}`}>{icon}</span>
          );

          const cls =
            "tab-item relative z-10 flex min-w-0 flex-1 items-center justify-center rounded-[23px] outline-none focus-visible:ring-2 focus-visible:ring-[#0A6DFE]/60";

          return item.href ? (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              onClick={() => handleTap(item)}
              className={cls}
            >
              {inner}
            </Link>
          ) : (
            <button key={item.id} type="button" aria-pressed={isActive} aria-label={item.label} onClick={() => handleTap(item)} className={cls}>
              {inner}
            </button>
          );
        })}
      </div>

      <style jsx global>{`
        .tab-glass {
          background: rgba(255, 255, 255, 0.74);
          -webkit-backdrop-filter: blur(24px) saturate(185%);
          backdrop-filter: blur(24px) saturate(185%);
          box-shadow:
            0 12px 32px rgba(15, 20, 25, 0.16),
            0 2px 6px rgba(15, 20, 25, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            inset 0 0 0 1px rgba(255, 255, 255, 0.55),
            0 0 0 0.5px rgba(15, 20, 25, 0.08);
        }
        .tab-glass--dark {
          background: rgba(28, 28, 30, 0.72);
          box-shadow:
            0 12px 32px rgba(0, 0, 0, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        }
        @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
          .tab-glass {
            background: rgba(255, 255, 255, 0.97);
          }
          .tab-glass--dark {
            background: rgba(28, 28, 30, 0.97);
          }
        }
        /* לחיצה: כל הבר מתכווץ קלות כל עוד האצבע על אחד הטאבים */
        .tab-glass {
          transform-origin: 50% 100%;
          transition: transform 180ms cubic-bezier(0.3, 0.7, 0.4, 1);
        }
        .tab-glass:has(.tab-item:active) {
          transform: scale(0.975);
        }
        /* שחרור: הבר חוזר בתנועה אלסטית עדינה - מתמתח מעט לרוחב ומתייצב */
        .tab-bar-bounce {
          animation: tab-bar-bounce 620ms cubic-bezier(0.25, 1, 0.4, 1);
        }
        @keyframes tab-bar-bounce {
          0% { transform: scale(0.975, 0.975); }
          30% { transform: scale(1.018, 0.985); }
          55% { transform: scale(0.995, 1.008); }
          78% { transform: scale(1.004, 0.999); }
          100% { transform: scale(1, 1); }
        }
        /* הגלולה מתמתחת לרגע בזמן שהיא נוסעת - תחושת "טיפה" */
        .tab-indicator-stretch {
          animation: tab-indicator-stretch 560ms cubic-bezier(0.3, 1.2, 0.5, 1);
        }
        @keyframes tab-indicator-stretch {
          0% { transform: scale(1, 1); }
          35% { transform: scale(1.14, 0.9); }
          70% { transform: scale(0.97, 1.03); }
          100% { transform: scale(1, 1); }
        }
        .tab-ai-glow {
          background: radial-gradient(circle, rgba(24, 119, 242, 0.35), transparent 70%);
          filter: blur(6px);
          animation: tab-ai-glow-pulse 2.6s ease-in-out infinite;
        }
        @keyframes tab-ai-glow-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        .tab-ai-ring {
          background: conic-gradient(from 0deg, transparent 0%, var(--color-primary-start) 30%, var(--color-primary-end) 50%, transparent 70%);
          padding: 3px;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: tab-ai-ring-spin 2.2s linear infinite;
        }
        @keyframes tab-ai-ring-spin {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tab-indicator,
          .tab-glass {
            transition: none !important;
            transform: none !important;
          }
          .tab-bar-bounce,
          .tab-indicator-stretch,
          .tab-ai-glow,
          .tab-ai-ring {
            animation: none !important;
          }
        }
      `}</style>
    </nav>
  );
}
