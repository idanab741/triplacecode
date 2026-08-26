"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
// "מקבלים" תנועה אופקית ממילא - האנכי הוא מה שדורש זיהוי מפורש כאן.
const HORIZONTAL_LOCK_BIAS = 1.4;
// "הצצה" קבועה תמיד גלויה, גם במנוחה - בדיוק העיקרון של REST_PEEK_PX
// ב-SwipeToDeleteRow.tsx (המחיקה בצד, בעמוד "הטיולים שלי"), רק דקה יותר
// (3px כאן מול 6px שם, לפי בקשה מפורשת) - רמז חזותי קבוע שיש כאן פעולת
// מחיקה זמינה, לא רק פידבק שמופיע תוך כדי הגרירה עצמה.
const REST_PEEK_PX = 3;
// "dead zone" קטן כדי שרעד טבעי של האצבע בתחילת מגע לא יגרום לזיהוי
// כיוון שגוי, לפני שהמחווה בכלל התכוונה ללכת לכיוון מסוים.
const DIRECTION_DEAD_ZONE_PX = 6;
// משך ה-snap אחרי שחרור - קצר ומיידי, לא אנימציה ארוכה.
const SNAP_TRANSITION = "transform 0.22s ease-out";

export function SwipeUpToDeleteCard({ onDelete, children, className = "" }: SwipeUpToDeleteCardProps) {
  // תיקון ביצועים (audit gesture pipeline): קודם dragY/dragging היו React
  // state שמתעדכן בכל pointermove -> re-render בכל פריים של הגרירה. עכשיו
  // אלה refs בלבד; ה-DOM מתעדכן ישירות דרך transform, וה-React state
  // (confirming) משמש רק למצבים הסופיים: פתוח-לאישור מחיקה / סגור.
  // finger -> gesture -> transform, לא finger -> state -> render -> DOM.
  const [confirming, setConfirming] = useState(false);

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startDragY = useRef(-REST_PEEK_PX);
  const dragY = useRef(-REST_PEEK_PX);
  const direction = useRef<"vertical" | "horizontal" | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const trashIconRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);
  const pendingY = useRef<number | null>(null);

  function applyTransform(y: number, withTransition: boolean) {
    const el = trackRef.current;
    if (el) {
      el.style.transition = withTransition ? SNAP_TRANSITION : "none";
      el.style.transform = `translateY(${y}px)`;
    }
    const progress = Math.min(1, Math.max(0, (-y - REST_PEEK_PX) / (DELETE_THRESHOLD_PX - REST_PEEK_PX)));
    if (trashIconRef.current) trashIconRef.current.style.opacity = String(progress);
  }

  // מיישרים את עדכוני ה-DOM לפריים הבא (rAF) כדי לא לבצע כמה כתיבות
  // transform באותו frame אם pointermove יורה כמה פעמים ברצף, ושהעדכון
  // יתבצע ממש לפני הציור, בלי layout thrash.
  function scheduleTransform(y: number) {
    pendingY.current = y;
    if (rafId.current != null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (pendingY.current != null) applyTransform(pendingY.current, false);
    });
  }

  function cancelScheduledTransform() {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }

  useEffect(() => cancelScheduledTransform, []);

  function handlePointerDown(e: React.PointerEvent) {
    if (confirming) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    startDragY.current = dragY.current;
    direction.current = null;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (startX.current == null || startY.current == null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (direction.current == null) {
      if (Math.abs(dx) < DIRECTION_DEAD_ZONE_PX && Math.abs(dy) < DIRECTION_DEAD_ZONE_PX) return;
      direction.current = Math.abs(dx) > Math.abs(dy) * HORIZONTAL_LOCK_BIAS ? "horizontal" : "vertical";
      if (direction.current === "vertical") {
        // הקאפצ'ר מגיע רק אחרי שהכיוון ננעל - לא לפני. אם ננעל "horizontal"
        // לא לוכדים כלום, כדי ש-embla (שמאזין ברמת הקרוסלה, מעל) ימשיך
        // לקבל את האירועים בלי הפרעה. סדר עקבי:
        // pointerdown -> direction detection -> gesture lock -> pointer capture -> drag.
        trackRef.current?.setPointerCapture(e.pointerId);
      }
    }
    if (direction.current !== "vertical") return;

    // תיקון Product מפורש ("מה הבעיה לנעול את הכרטיסייה ברגע שעומדים
    // עליו וגוררים למעלה?? כרגע זה לא נותן להחליק"): setPointerCapture
    // לבד לא מספיק - embla מאזין ברמת ה-viewport (אב, לא ילד) לאותו
    // pointermove, ומתחיל "לעקוב" אחרי הגרירה כמועמדת-לגרירה-אופקית-
    // שלו מהתזוזה הראשונה, בלי לדעת שכיוון ננעל אנכית אצלנו - זה מה
    // ש"בולע" את המחווה בפועל (embla "מנצח" את הריצוף, למרות שהחלטנו
    // כאן שזו כוונת מחיקה). ברגע שכיוון ננעל אנכית, stopPropagation
    // עוצר את האירוע מלהמשיך להאב (embla) לגמרי - לא רק preventDefault
    // (שרק מבטל scroll טבעי, לא "משתיק" מאזינים אחרים על אותו אירוע).
    e.stopPropagation();

    // ברגע שהכיוון ננעל אנכית, מונעים מהדפדפן "לגנוב" את המחווה כ-scroll
    // טבעי. touch-action לבד לא מספיק פה כי touchAction: pan-y (למטה)
    // מאפשר במפורש scroll אנכי טבעי - בכוונה, כדי לא לחסום גלילת עמוד
    // רגילה כברירת מחדל. ברגע שזיהינו בפועל כוונת מחיקה, ה-preventDefault
    // הזה עוצר את ה-scroll הטבעי מלהמשיך, באותו האופן שבו embla עצמו
    // קורא ל-preventDefault כשהוא מזהה גרירה אופקית.
    if (e.cancelable) e.preventDefault();

    const next = Math.min(-REST_PEEK_PX, startDragY.current + dy);
    dragY.current = next;
    scheduleTransform(next);
  }

  function handlePointerUp() {
    const wasVertical = direction.current === "vertical";
    startX.current = null;
    startY.current = null;
    direction.current = null;
    if (!wasVertical) return;

    cancelScheduledTransform();

    if (-dragY.current > DELETE_THRESHOLD_PX) {
      setConfirming(true);
    } else {
      dragY.current = -REST_PEEK_PX;
      applyTransform(-REST_PEEK_PX, true);
    }
  }

  function handleCancelConfirm() {
    dragY.current = -REST_PEEK_PX;
    setConfirming(false);
  }

  return (
    <div className={`relative w-full ${className}`}>
      {!confirming && (
        <div className="absolute inset-0 flex items-end justify-center rounded-card bg-danger">
          <div ref={trashIconRef} className="flex flex-col items-center gap-1 pb-3 text-white" style={{ opacity: 0 }}>
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
          transform: `translateY(${confirming ? -DELETE_THRESHOLD_PX : -REST_PEEK_PX}px)`,
          transition: SNAP_TRANSITION,
          // תיקון touch-action (audit): קודם היה pan-x. הכרטיס יושב בתוך
          // ה-viewport של embla, ו-embla עצמו מגדיר על ה-viewport שלו
          // touch-action: pan-y (כדי לאפשר גלילה אנכית טבעית של העמוד,
          // בזמן שהוא מזהה גרירה אופקית ב-JS ועושה לה preventDefault
          // בעצמו). pan-x כאן היה מתנגש עם ה-pan-y של ההורה - הערך
          // האפקטיבי (used value) של touch-action הוא חיתוך בין האלמנט
          // לאבותיו, ו-pan-y ∩ pan-x = ריק, כלומר זה חסם גם גלילה אנכית
          // טבעית לגמרי באזור הכרטיס. עכשיו pan-y כאן תואם את ה-pan-y של
          // embla (החיתוך = pan-y, לא ריק): גלילה אנכית טבעית מותרת
          // כברירת מחדל, ורק כש-JS מזהה בפועל כוונת מחיקה אנכית,
          // ה-preventDefault למעלה עוצר את ה-scroll הטבעי מלהמשיך - בדיוק
          // כמו ש-embla עוצר scroll אופקי טבעי כשהוא מזהה גרירה אופקית.
          touchAction: "pan-y",
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
