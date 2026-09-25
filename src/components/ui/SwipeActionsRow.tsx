"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface SwipeAction {
  key: string;
  label: string;
  icon: ReactNode;
  /** צבע הרקע של הכפתור */
  color: string;
  onClick: () => void;
}

interface SwipeActionsRowProps {
  children: ReactNode;
  /** החלקה ימינה -> כפתור הסרה אדום (בצד שמאל) */
  onDelete?: () => void;
  deleteLabel?: string;
  /** החלקה שמאלה -> כפתורי פעולה (בצד ימין), למשל יומן / הוספה ל... */
  actions?: SwipeAction[];
  /** למשל בזמן בחירה מרובה - אין החלקה */
  disabled?: boolean;
  /** שינוי במפתח סוגר את השורה (למשל אחרי שהרשימה השתנתה) */
  resetKey?: string;
  className?: string;
}

const BUTTON_W = 76;
const DEAD_ZONE = 8;
const LONG_PRESS_MS = 480;
const SNAP = "transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1)";
const OPEN_EVENT = "swipe-actions-row:open";

function TrashIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9.5 7V4.8c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8V7M6.5 7l.8 12.2c.1.9.8 1.8 1.8 1.8h5.8c1 0 1.7-.9 1.8-1.8L17.5 7" />
    </svg>
  );
}

/**
 * *** בקשה מפורשת ("שיטת החלקות בשורה - כמו בהודעות באייפון"): שורה ברשימה עם פעולות בהחלקה.
 *  - החלקה ימינה: כפתור הסרה אדום.
 *  - החלקה שמאלה: כפתורי פעולה (יומן, הוספה ל...).
 * נגיש גם בלי החלקה: לחיצה ארוכה (או לחיצה ימנית) פותחת את הפעולות, והכפתורים הם כפתורים אמיתיים -
 * מעבר אליהם במקלדת / בקורא מסך חושף את הצד שלהם. רק שורה אחת פתוחה בכל רגע; לחיצה על שורה פתוחה סוגרת אותה.
 */
export function SwipeActionsRow({ children, onDelete, deleteLabel = "הסרה", actions = [], disabled = false, resetKey, className = "" }: SwipeActionsRowProps) {
  const id = useId();
  const leftW = onDelete ? BUTTON_W : 0; // נחשף בהחלקה ימינה
  const rightW = actions.length * BUTTON_W; // נחשף בהחלקה שמאלה
  const trackRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const x = useRef(0);
  const start = useRef<{ x: number; y: number; offset: number } | null>(null);
  const direction = useRef<"h" | "v" | null>(null);
  const moved = useRef(false);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState<"left" | "right" | null>(null);

  function apply(next: number, animate: boolean) {
    x.current = next;
    // הכפתורים מוצגים רק בצד שנחשף - כך אין "שוליים" צבעוניים בפינות העגולות כשהשורה סגורה
    if (rootRef.current) rootRef.current.dataset.side = next > 0.5 ? "left" : next < -0.5 ? "right" : "none";
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate ? SNAP : "none";
    el.style.transform = `translateX(${next}px)`;
  }

  function snapTo(side: "left" | "right" | null) {
    apply(side === "left" ? leftW : side === "right" ? -rightW : 0, true);
    setOpen(side);
    if (side) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
  }

  // שורה אחרת נפתחה -> נסגרים
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id && x.current !== 0) {
        apply(0, true);
        setOpen(null);
      }
    };
    window.addEventListener(OPEN_EVENT, onOther);
    return () => window.removeEventListener(OPEN_EVENT, onOther);
  }, [id]);

  // שינוי ב-resetKey / disabled סוגר את השורה (עדכון מצב בזמן רינדור, ואז איפוס ה-DOM)
  const resetSignature = `${resetKey ?? ""}|${disabled}`;
  const [lastReset, setLastReset] = useState(resetSignature);
  if (lastReset !== resetSignature) {
    setLastReset(resetSignature);
    setOpen(null);
  }
  useEffect(() => {
    apply(0, false);
  }, [resetSignature]);

  function clearLongPress() {
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = null;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (disabled || (leftW === 0 && rightW === 0)) return;
    start.current = { x: e.clientX, y: e.clientY, offset: x.current };
    direction.current = null;
    moved.current = false;
    clearLongPress();
    if (rightW > 0 && x.current === 0) {
      longPress.current = setTimeout(() => {
        moved.current = true; // שלא ייחשב כלחיצה
        navigator.vibrate?.(10);
        snapTo("right");
      }, LONG_PRESS_MS);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!direction.current) {
      if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return;
      clearLongPress();
      direction.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (direction.current === "h") (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (direction.current !== "h") return;
    moved.current = true;
    // התנגדות קלה אחרי הקצה
    const raw = s.offset + dx;
    const max = leftW;
    const min = -rightW;
    const next = raw > max ? max + (raw - max) * 0.25 : raw < min ? min + (raw - min) * 0.25 : raw;
    apply(next, false);
  }

  function onPointerUp() {
    clearLongPress();
    const s = start.current;
    start.current = null;
    if (!s || direction.current !== "h") return;
    const cur = x.current;
    if (leftW && cur > leftW / 2) snapTo("left");
    else if (rightW && cur < -rightW / 2) snapTo("right");
    else snapTo(null);
  }

  // לחיצה על שורה פתוחה / אחרי גרירה - רק סוגרת, לא פותחת את הפריט
  function onClickCapture(e: React.MouseEvent) {
    // הלחיצה שהדפדפן יורה מיד אחרי גרירה / לחיצה ארוכה - מתעלמים ממנה (השורה נשארת פתוחה)
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
      return;
    }
    // לחיצה על שורה פתוחה - סוגרת אותה במקום לפתוח את הפריט
    if (open) {
      e.preventDefault();
      e.stopPropagation();
      snapTo(null);
    }
  }

  function run(fn: () => void) {
    snapTo(null);
    fn();
  }

  return (
    <div ref={rootRef} data-side="none" className={`group relative overflow-hidden ${className}`} onContextMenu={(e) => rightW > 0 && !disabled && (e.preventDefault(), snapTo("right"))}>
      {/* הסרה - בצד שמאל, נחשף בהחלקה ימינה */}
      {onDelete && !disabled && (
        <div className="absolute inset-y-0 left-0 flex opacity-0 group-data-[side=left]:opacity-100" style={{ width: leftW }} dir="ltr">
          <button
            type="button"
            onClick={() => run(onDelete)}
            onFocus={() => snapTo("left")}
            className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#E5484D] text-[12px] font-semibold text-white"
          >
            <TrashIcon />
            {deleteLabel}
          </button>
        </div>
      )}
      {/* פעולות - בצד ימין, נחשפות בהחלקה שמאלה */}
      {actions.length > 0 && !disabled && (
        <div className="absolute inset-y-0 right-0 flex opacity-0 group-data-[side=right]:opacity-100" style={{ width: rightW }} dir="rtl">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => run(a.onClick)}
              onFocus={() => snapTo("right")}
              className="flex h-full flex-1 flex-col items-center justify-center gap-1 text-[12px] font-semibold text-white"
              style={{ background: a.color }}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
      <div
        ref={trackRef}
        className="relative bg-white"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
