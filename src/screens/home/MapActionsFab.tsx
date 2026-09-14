"use client";

import { useState, type ReactNode } from "react";

interface MapActionsFabProps {
  onAddPlace: () => void;
  onFilter: () => void;
  /** מספר הפילטרים הפעילים כרגע - מוצג כ-badge קטן על הכפתור (סעיף 11). */
  activeFilterCount: number;
}

function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function AddPlaceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

/**
 * *** כפתור ה-(+) הצף מעל המפה + תפריט הפעולות הקטן שנפתח ממנו (בקשה
 * מפורשת, פרומפט "FAB + Floating Actions" מלא). לא Modal מיידי, לא
 * FAB גנרי של Android - תפריט Floating Actions קטן: ה-+ מסתובב ל-×,
 * ומעליו שתי תיבות pill קומפקטיות (לא כפתורים עגולים נוספים).
 *
 * מידות/מיקום מדויקים לפי הבקשה: כפתור 52×52, right:16px, ~16px מעל
 * ה-Bottom Navigation (משתמש באותו חישוב safe-area שכבר הוכח ב-
 * AddPlaceFab/LocateMeFab הקודמים באפליקציה - לא ממציא נוסחה חדשה).
 * shadow-soft בלבד (הטוקן הקיים) - לא glow, לא shadow כבד.
 *
 * תיבות הפעולה: rounded-[14px] (לא rounded-pill המלא של האפליקציה -
 * הבקשה המפורשת כאן היא 14px בדיוק, לא קפסולה מלאה), רקע לבן, גובה
 * 44px, אייקון+טקסט. אנימציית כניסה: opacity+scale+translateY עם
 * stagger קצר בין השתיים (הוספת מקום קודם, כי היא הקרובה יותר ל-FAB).
 */
export function MapActionsFab({ onAddPlace, onFilter, activeFilterCount }: MapActionsFabProps) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  return (
    <>
      {/* לחיצה על אזור ריק במפה סוגרת את התפריט (סעיף 4) - שכבה שקופה
          לגמרי, רק לתפיסת הלחיצה, לא overlay חזותי (זה שונה מה-Modal
          עצמו, שכן צריך overlay עדין - ר' AddPlaceModal). */}
      {open && (
        <div
          aria-hidden
          onClick={close}
          className="fixed inset-0 z-30"
        />
      )}

      <div
        className="fixed z-40 flex flex-col items-end gap-2"
        style={{
          right: "1rem",
          bottom: "calc(max(env(safe-area-inset-bottom), 22px) + 78px)",
        }}
      >
        {/* תיבת "סינון" - שנייה מלמעלה בסדר ה-DOM, אבל מלמעלה ויזואלית
            (flex-col-reverse למטה היה מסבך RTL/stagger - סדר ה-DOM כאן
            כבר "סינון" למעלה, "הוספת מקום" למטה, קרוב ל-FAB, כמו שהתבקש). */}
        <ActionPill
          visible={open}
          delayMs={90}
          label="סינון"
          icon={<FilterIcon />}
          badge={activeFilterCount > 0 ? activeFilterCount : undefined}
          onClick={() => {
            close();
            onFilter();
          }}
        />
        <ActionPill
          visible={open}
          delayMs={30}
          label="הוספת מקום"
          icon={<AddPlaceIcon />}
          onClick={() => {
            close();
            onAddPlace();
          }}
        />

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "סגירת תפריט הפעולות" : "פתיחת תפריט הפעולות"}
          aria-expanded={open}
          className="relative flex items-center justify-center rounded-full text-white shadow-soft transition-transform duration-200 ease-out active:scale-95"
          style={{
            width: 52,
            height: 52,
            background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          <PlusIcon />
          {!open && activeFilterCount > 0 && (
            <span
              className="absolute -left-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
              style={{ background: "var(--color-primary-end)" }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}

interface ActionPillProps {
  visible: boolean;
  delayMs: number;
  label: string;
  icon: ReactNode;
  badge?: number;
  onClick: () => void;
}

/** תיבת פעולה בודדת - pill קומפקטי, לא כפתור עגול. מוצג/נעלם תמיד
 *  (לא unmount/mount - כדי שהאנימציה ההפוכה בסגירה תרוץ חלק, לא
 *  "תיעלם בפתאומיות"), רק visibility/opacity/transform משתנים. */
function ActionPill({ visible, delayMs, label, icon, badge, onClick }: ActionPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className="relative flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[14px] bg-white px-3.5 text-[14px] font-semibold text-ink shadow-soft"
      style={{
        height: 44,
        minWidth: 120,
        maxWidth: 145,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.92)",
        transition: `opacity 240ms ease-out ${delayMs}ms, transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms`,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <span className="text-ink-secondary">{icon}</span>
      <span>{label}</span>
      {badge !== undefined && (
        <span
          className="flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9.5px] font-bold leading-none text-white"
          style={{ background: "var(--color-primary-start)" }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
