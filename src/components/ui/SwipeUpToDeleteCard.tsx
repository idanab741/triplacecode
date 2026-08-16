"use client";

import { useRef, useState, type ReactNode } from "react";

interface SwipeUpToDeleteCardProps {
  onDelete: () => void;
  children: ReactNode;
  className?: string;
}

const DELETE_THRESHOLD_PX = 45;
// תיקון: הכרטיס הזה יושב בתוך קרוסלה שנגררת אופקית (embla) - שתי ג'סטורות
// (החלקה אנכית למחיקה מול גרירה אופקית לדפדוף) מתחרות על אותה נגיעה.
// קודם ה"נעילה" לכיוון (אנכי/אופקי) הייתה סימטרית (הראשון שגדול יותר
// מנצח) - מספיק סטייה קטנה בהתחלה (טבעית באצבע) כדי שהתנועה תינעל אופקית
// ותפספס לגמרי את כוונת המחיקה. מטים את הנעילה לטובת אנכי - נדרשת עדיפות
// אופקית ברורה (לא רק "מעט יותר") כדי לנעול אופקית, כי הדפדפן/embla כבר
// "מקבלים" תנועה אופקית ממילא (touchAction: pan-x למטה) - האנכי הוא מה
// שדורש זיהוי מפורש כאן.
const HORIZONTAL_LOCK_BIAS = 1.4;
// "הצצה" קבועה תמיד גלויה, גם במנוחה - בדיוק העיקרון של REST_PEEK_PX
// ב-SwipeToDeleteRow.tsx (המחיקה בצד, בעמוד "הטיולים שלי"), רק דקה יותר
// (3px כאן מול 6px שם, לפי בקשה מפורשת) - רמז חזותי קבוע שיש כאן פעולת
// מחיקה זמינה, לא רק פידבק שמופיע תוך כדי הגרירה עצמה. בלי להזיז את
// nesty התוכן כלפי מעלה ב-REST_PEEK_PX **כברירת מחדל** (לא רק 0), הפס
// היה תמיד מוסתר לגמרי מתחת לתוכן האטום שמעליו - בדיוק מה שקרה בניסיון
// הראשון (הוספתי את הפס אבל התוכן כיסה אותו לחלוטין במנוחה).
const REST_PEEK_PX = 3;

export function SwipeUpToDeleteCard({ onDelete, children, className = "" }: SwipeUpToDeleteCardProps) {
  const [dragY, setDragY] = useState(-REST_PEEK_PX);
  const [dragging, setDragging] = useState(false);
  // תיקון: קודם חציית הסף הייתה מוחקת מיד (מעיפה את הכרטיס ומוחקת אחרי
  // אנימציה) - בלי שום "בטוח?" בכלל. עכשיו חציית הסף רק *פותחת* בקשת
  // אישור (נשארת פתוחה, לא נסגרת אוטומטית) - מחיקה בפועל קורית רק
  // בלחיצה מפורשת על "מחק".
  const [confirming, setConfirming] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startDragY = useRef(-REST_PEEK_PX);
  const direction = useRef<"vertical" | "horizontal" | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  function handlePointerDown(e: React.PointerEvent) {
    if (confirming) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    startDragY.current = dragY;
    direction.current = null;
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (startX.current == null || startY.current == null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (direction.current == null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      direction.current = Math.abs(dx) > Math.abs(dy) * HORIZONTAL_LOCK_BIAS ? "horizontal" : "vertical";
      if (direction.current === "vertical") {
        trackRef.current?.setPointerCapture(e.pointerId);
      }
    }
    if (direction.current !== "vertical") return;

    setDragY(Math.min(-REST_PEEK_PX, startDragY.current + dy));
  }

  function handlePointerUp() {
    const wasVertical = direction.current === "vertical";
    startX.current = null;
    startY.current = null;
    direction.current = null;
    setDragging(false);
    if (!wasVertical) return;

    if (-dragY > DELETE_THRESHOLD_PX) {
      setConfirming(true);
    } else {
      setDragY(-REST_PEEK_PX);
    }
  }

  function handleCancelConfirm() {
    setConfirming(false);
    setDragY(-REST_PEEK_PX);
  }

  const revealProgress = Math.min(1, Math.max(0, (-dragY - REST_PEEK_PX) / (DELETE_THRESHOLD_PX - REST_PEEK_PX)));

  return (
    <div className={`relative w-full ${className}`}>
      {!confirming && (
        <div className="absolute inset-0 flex items-end justify-center rounded-card bg-danger">
          <div className="flex flex-col items-center gap-1 pb-3 text-white" style={{ opacity: revealProgress }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
            </svg>
          </div>
        </div>
      )}

      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateY(${confirming ? -DELETE_THRESHOLD_PX : dragY}px)`,
          transition: dragging ? "none" : "transform 0.22s ease-out",
          touchAction: "pan-x",
        }}
        className="relative"
      >
        {children}
      </div>

      {confirming && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-card bg-black/75 p-3 text-center">
          <p className="text-xs font-semibold text-white">למחוק את הטיול הזה?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-pill bg-danger px-3 py-1.5 text-xs font-semibold text-white"
            >
              כן, מחק
            </button>
            <button
              type="button"
              onClick={handleCancelConfirm}
              className="rounded-pill bg-white/15 px-3 py-1.5 text-xs font-semibold text-white"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
