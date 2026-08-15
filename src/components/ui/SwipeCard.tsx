"use client";

import { Fragment, useRef, type ReactNode } from "react";
import Image from "next/image";

interface SwipeCardActions {
  onLike: () => void;
  onNope: () => void;
  disabled?: boolean;
}

interface SwipeCardProps {
  /** *** שדרוג UI/UX (TripMatch בלבד): SwipeCard משמש גם במסכי trip-builder
   *  אחרים (build page) עם כפתורי Like/X חיצוניים צפים - כדי לא לשבור
   *  אותם, children תומך בשני מצבים:
   *  1) ReactNode רגיל (ברירת המחדל הישנה) - הכרטיס מוצג כמו שהוא, וה-
   *     כפתורים החיצוניים הישנים (fixed) ממשיכים להופיע מתחת לכרטיס,
   *     בדיוק כמו קודם. זה המצב שמשמש trip-builder/build.
   *  2) פונקציית render-prop שמקבלת onLike/onNope/disabled - משמש כרטיסים
   *     כמו TripMatchCard שמשלבים את כפתורי הפעולה *בתוך* הכרטיס עצמו;
   *     במצב הזה לא מוצגים הכפתורים החיצוניים (הכרטיס כבר כולל אותם). */
  children: ReactNode | ((actions: SwipeCardActions) => ReactNode);
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  disabled?: boolean;
}

const SWIPE_THRESHOLD_PX = 100;
const FLY_OUT_DISTANCE_PX = 500;

/**
 * כרטיס נגרר (Like ימינה, Unlike שמאלה) - pointer events + CSS transform,
 * בלי ספריית gesture חיצונית. הרכיב תלוי בכך שההורה יעביר key ייחודי לכל
 * מועמד (כדי שהכרטיס יתחיל מאפס בכל מיפוי מחדש).
 *
 * *** נוסף: תגיות ❤️/✕ שמופיעות מעל הכרטיס תוך כדי הגרירה (בסגנון
 * OkCupid/Tinder) - האטימות שלהן גדלה בהדרגה ככל שגוררים רחוק יותר,
 * ומגיעה למקסימום כשעוברים את הסף שגורם ל-swipe. מעודכן ישירות על ה-DOM
 * (לא דרך React state) כדי לא לגרום ל-re-render בכל תזוזת עכבר/אצבע.
 */
export function SwipeCard({ children, onSwipeLeft, onSwipeRight, disabled }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const likeStampRef = useRef<HTMLDivElement>(null);
  const nopeStampRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ startX: 0, currentX: 0, dragging: false, pointerId: -1 });

  function setStamps(x: number) {
    const progress = Math.min(1, Math.abs(x) / SWIPE_THRESHOLD_PX);
    if (likeStampRef.current) likeStampRef.current.style.opacity = x > 0 ? String(progress) : "0";
    if (nopeStampRef.current) nopeStampRef.current.style.opacity = x < 0 ? String(progress) : "0";
  }

  function setTransform(x: number, withTransition: boolean) {
    const el = cardRef.current;
    if (!el) return;
    // *** תיקון קצב: 0.3s+250ms היה מרגיש איטי כשמצטבר לאורך הרבה
    // swipes ברצף - קוצר ל-0.22s+180ms, קצב עקבי ומהיר יותר אך עדיין חלק.
    el.style.transition = withTransition ? "transform 0.22s ease, opacity 0.22s ease" : "none";
    el.style.transform = `translateX(${x}px) rotate(${x / 20}deg)`;
    el.style.opacity = `${Math.max(0, 1 - Math.abs(x) / (FLY_OUT_DISTANCE_PX * 1.5))}`;
    setStamps(x);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (disabled) return;
    dragState.current = { startX: e.clientX, currentX: 0, dragging: true, pointerId: e.pointerId };
    cardRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current.dragging) return;
    const deltaX = e.clientX - dragState.current.startX;
    dragState.current.currentX = deltaX;
    setTransform(deltaX, false);
  }

  function handlePointerUp() {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;

    const deltaX = dragState.current.currentX;
    if (deltaX > SWIPE_THRESHOLD_PX) {
      flyOut("right");
    } else if (deltaX < -SWIPE_THRESHOLD_PX) {
      flyOut("left");
    } else {
      setTransform(0, true);
    }
  }

  function flyOut(direction: "left" | "right") {
    const distance = direction === "right" ? FLY_OUT_DISTANCE_PX : -FLY_OUT_DISTANCE_PX;
    if (likeStampRef.current) likeStampRef.current.style.opacity = direction === "right" ? "1" : "0";
    if (nopeStampRef.current) nopeStampRef.current.style.opacity = direction === "left" ? "1" : "0";
    setTransform(distance, true);
    window.setTimeout(() => {
      if (direction === "right") onSwipeRight();
      else onSwipeLeft();
    }, 180);
  }

  const isInlineActionsMode = typeof children === "function";
  const resolvedChildren = isInlineActionsMode
    ? (children as (actions: SwipeCardActions) => ReactNode)({
        onLike: () => flyOut("right"),
        onNope: () => flyOut("left"),
        disabled,
      })
    : children;

  return (
    <Fragment>
      <div
        ref={cardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="h-full touch-none select-none"
        style={{ willChange: "transform" }}
      >
        <div className="relative h-full">
          {resolvedChildren}

          {/* תגית "אהבתי" - מופיעה תוך כדי גרירה ימינה */}
          <div
            ref={likeStampRef}
            className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0"
            style={{ transition: "opacity 0.1s ease" }}
          >
            <Image src="/images/tripmatch/action-like.png" alt="" width={140} height={140} className="drop-shadow-2xl" />
          </div>

          {/* תגית "לא מתאים" - מופיעה תוך כדי גרירה שמאלה */}
          <div
            ref={nopeStampRef}
            className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0"
            style={{ transition: "opacity 0.1s ease" }}
          >
            <Image src="/images/tripmatch/action-nope.png" alt="" width={140} height={140} className="drop-shadow-2xl" />
          </div>
        </div>
      </div>

      {/* כפתורים חיצוניים צפים - רק במצב הישן (children כ-ReactNode רגיל,
          כמו ב-trip-builder/build). כשה-children היא פונקציה (TripMatchCard),
          הכרטיס עצמו כבר כולל אזור פעולה משולב ולא צריך את הכפתורים האלה. */}
      {!isInlineActionsMode && (
        <div
          className="fixed inset-x-0 z-40 flex items-center justify-center gap-8"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 86px)" }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => flyOut("right")}
            aria-label="אהבתי"
            className="transition active:scale-90 disabled:opacity-50"
          >
            <Image src="/images/tripmatch/action-like.png" alt="" width={68} height={68} />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => flyOut("left")}
            aria-label="לא מתאים"
            className="transition active:scale-90 disabled:opacity-50"
          >
            <Image src="/images/tripmatch/action-nope.png" alt="" width={68} height={68} />
          </button>
        </div>
      )}
    </Fragment>
  );
}
