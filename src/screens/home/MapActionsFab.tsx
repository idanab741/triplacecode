"use client";

import type { ReactNode } from "react";

interface MapActionsFabProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
 * *** כפתור ה-(+) הצף מעל המפה + תפריט הפעולות הקטן שנפתח ממנו.
 * *** תיקון-שורש (Bug - "המצפן אפילו לא לחיץ!"): ה-wrapper הזה נשאר
 * תמיד באותו גובה (160px) גם כשסגור, כי שני עיגולי הפעולה נשארים
 * בזרימת ה-flex (רק opacity:0, לא display:none) - ה-div השקוף הזה
 * חפף פיזית את המיקום של LocateMeFab (אותו z-40, אבל מאוחר יותר
 * ב-DOM = מצויר מעליו) ובלע לו את כל הלחיצות בשקט, בלי שום שגיאה.
 * זו לא הייתה בעיה ב-JS/geolocation בכלל - זו הייתה שכבת CSS שחסמה
 * את הלחיצה לפני שהיא בכלל הגיעה לקוד. עכשיו ה-wrapper עצמו
 * pointer-events-none, וכל כפתור אמיתי בתוכו מקבל בחזרה
 * pointer-events-auto במפורש - בדיוק אותו תיקון שכבר עבד ב-page.tsx
 * הראשי בשביל המפה מתחת לתוכן.
 */
export function MapActionsFab({ open, onOpenChange, onAddPlace, onFilter, activeFilterCount }: MapActionsFabProps) {
  function close() {
    onOpenChange(false);
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
        className="pointer-events-none fixed flex flex-col items-center gap-2.5"
        style={{
          left: "1.25rem",
          bottom: "calc(max(env(safe-area-inset-bottom), 22px) + 78px)",
          zIndex: 9999,
        }}
      >
        <ActionIcon
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
        <ActionIcon
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
          onClick={() => onOpenChange(!open)}
          aria-label={open ? "סגירת תפריט הפעולות" : "פתיחת תפריט הפעולות"}
          aria-expanded={open}
          className="pointer-events-auto relative flex items-center justify-center rounded-full text-white shadow-soft transition-transform duration-200 ease-out active:scale-95"
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

interface ActionIconProps {
  visible: boolean;
  delayMs: number;
  label: string;
  icon: ReactNode;
  badge?: number;
  onClick: () => void;
}

/** עיגול פעולה בודד - אייקון בלבד, בלי טקסט (בקשה מפורשת). מוצג/נעלם
 *  תמיד (לא unmount/mount, כדי שהאנימציה ההפוכה בסגירה תרוץ חלק). */
function ActionIcon({ visible, delayMs, label, icon, badge, onClick }: ActionIconProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className="relative flex items-center justify-center rounded-full bg-white text-ink shadow-soft"
      style={{
        width: 44,
        height: 44,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.92)",
        transition: `opacity 240ms ease-out ${delayMs}ms, transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms`,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {icon}
      {badge !== undefined && (
        <span
          className="absolute -left-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9.5px] font-bold leading-none text-white"
          style={{ background: "var(--color-primary-start)" }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
