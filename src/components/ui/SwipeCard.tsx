"use client";

import { Fragment, forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import Image from "next/image";

interface SwipeCardActions {
  onLike: () => void;
  onNope: () => void;
  disabled?: boolean;
}

/** *** חדש (בקשה מפורשת - "הכפתורים צריכים להיות קבועים, לא זזים
 *  כשמחליקים"): API אימפרטיבי דרך ref - מאפשר להורה להפעיל
 *  like()/nope() מכפתורים שיושבים *מחוץ* ל-SwipeCard (ולכן לא זזים
 *  עם ה-transform שלו בזמן גרירה), במקום חובה להעביר אותם דרך
 *  ה-render-prop (מצב 2 למטה) שממקם אותם בפועל בתוך האלמנט הנגרר. */
export interface SwipeCardHandle {
  like: () => void;
  nope: () => void;
}

interface SwipeCardProps {
  /** *** שדרוג UI/UX (TripMatch בלבד): SwipeCard משמש גם במסכי trip-builder
   *  אחרים (build page) עם כפתורי Like/X חיצוניים צפים - כדי לא לשבור
   *  אותם, children תומך בשני מצבים:
   *  1) ReactNode רגיל (ברירת המחדל הישנה) - הכרטיס מוצג כמו שהוא, וה-
   *     כפתורים החיצוניים הישנים (fixed) ממשיכים להופיע מתחת לכרטיס,
   *     בדיוק כמו קודם. זה המצב שמשמש trip-builder/build.
   *  2) פונקציית render-prop שמקבלת onLike/onNope/disabled - משמש כרטיסים
   *     שרוצים לשלב את כפתורי הפעולה *בתוך* האלמנט הנגרר עצמו (זז יחד
   *     עם הכרטיס בגרירה).
   *  TripMatch עצמו כבר לא משתמש באף אחת מהאפשרויות האלה לכפתורים -
   *  הכפתורים שלו קבועים, יושבים מחוץ ל-SwipeCard לגמרי, ומופעלים דרך
   *  ה-ref (SwipeCardHandle) - ר' tripmatch/page.tsx. */
  children: ReactNode | ((actions: SwipeCardActions) => ReactNode);
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  disabled?: boolean;
  /** *** חדש (בקשה מפורשת - "לחיצה על הכרטיסיה פותחת את העמוד שלה / לחיצה
   *  על הצדדים מחליפה תמונה"): נקרא כשהמשתמש *לוחץ* על הכרטיס (נגיעה קצרה
   *  בלי גרירה). xFraction = מיקום הלחיצה לרוחב הכרטיס, 0 = קצה שמאלי פיזי,
   *  1 = קצה ימני פיזי. מטופל כאן ולא ב-onClick של הילדים, כי ה-pointer
   *  capture של הגרירה גורם ל-click להגיע לעטיפה ולא לילד, ובנוסף אחרי
   *  גרירה הדפדפן היה יורה click לא רצוני. אופציונלי - בלעדיו (למשל
   *  trip-builder/build) ההתנהגות זהה לקודם. */
  onTap?: (info: { xFraction: number }) => void;
  /** *** חדש (בקשה מפורשת - הבר העליון שנדבק/מתכווץ בגלילה): כשהכרטיס יושב
   *  בעמוד שגולל (עמוד הבית), touch-action: none חסם גלילה אנכית בכל נגיעה
   *  על הכרטיס - אי אפשר היה לגלול את העמוד מתוך אזור הכרטיסייה בכלל.
   *  עם true: גרירה אנכית גוללת את העמוד (הדפדפן שולח pointercancel, וההחלקה
   *  לא מתבצעת), וגרירה אופקית ממשיכה להחליק את הכרטיס כרגיל. ברירת המחדל
   *  false - בדיוק ההתנהגות הקודמת (למשל trip-builder). */
  allowVerticalScroll?: boolean;
}

const SWIPE_THRESHOLD_PX = 100;
/** תזוזה מקסימלית (px) שעדיין נחשבת "לחיצה" ולא גרירה. */
const TAP_SLOP_PX = 10;
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
export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { children, onSwipeLeft, onSwipeRight, disabled, onTap, allowVerticalScroll = false },
  ref
) {
  const cardRef = useRef<HTMLDivElement>(null);
  const likeStampRef = useRef<HTMLDivElement>(null);
  const nopeStampRef = useRef<HTMLDivElement>(null);
  // *** חדש (בקשה מפורשת - "מדויק ומיידי, בלי משחקים במעברים"): ברגע שהכרטיס
  // התחיל לעוף החוצה הוא "סגור" - אי אפשר להפעיל אותו שוב (לחיצה כפולה על
  // X/לב, או נגיעה בכרטיס שעדיין עף). בלי זה, שתי הפעלות בתוך 180ms הפעילו
  // את onSwipe פעמיים על אותו כרטיס. הכרטיס נבנה מחדש (key) לכל מועמד, ולכן
  // הדגל מתאפס מעצמו בכרטיס הבא.
  const flyingRef = useRef(false);
  const dragState = useRef({ startX: 0, startY: 0, currentX: 0, dragging: false, moved: false, pointerId: -1 });

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
    // *** תיקון ביצועים (בלי לשנות שום דבר ויזואלי): translate3d במקום
    // translateX מבטיח בעקביות רבה יותר (בעיקר ב-iOS Safari) שהדפדפן
    // מקדם את השכבה הזו לשכבת GPU נפרדת לאורך כל הגרירה, במקום לצייר
    // מחדש ב-CPU בכל פריים - אותה תוצאה ויזואלית בדיוק (translate3d עם
    // z=0 שקול מתמטית ל-translateX), רק מהיר/חלק יותר על המכשיר.
    el.style.transform = `translate3d(${x}px, 0, 0) rotate(${x / 20}deg)`;
    el.style.opacity = `${Math.max(0, 1 - Math.abs(x) / (FLY_OUT_DISTANCE_PX * 1.5))}`;
    setStamps(x);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (disabled || flyingRef.current) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, currentX: 0, dragging: true, moved: false, pointerId: e.pointerId };
    cardRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current.dragging) return;
    const deltaX = e.clientX - dragState.current.startX;
    dragState.current.currentX = deltaX;
    // מרגע שהאצבע זזה מעבר ל-slop זו גרירה ולא לחיצה - גם אם חזרה לנקודת ההתחלה.
    if (Math.abs(deltaX) > TAP_SLOP_PX || Math.abs(e.clientY - dragState.current.startY) > TAP_SLOP_PX) {
      dragState.current.moved = true;
    }
    // בתוך ה-slop לא מזיזים את הכרטיס בכלל, כדי שלחיצה לא תרעיד אותו.
    setTransform(dragState.current.moved ? deltaX : 0, false);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;

    // לחיצה (pointerup בלי גרירה) - לא מפעילים swipe, רק מדווחים להורה.
    // pointercancel (למשל הדפדפן השתלט על המחווה) הוא לעולם לא לחיצה.
    if (!dragState.current.moved && e.type === "pointerup") {
      setTransform(0, false);
      const rect = cardRef.current?.getBoundingClientRect();
      if (onTap && rect && rect.width > 0) {
        onTap({ xFraction: (e.clientX - rect.left) / rect.width });
      }
      return;
    }

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
    if (flyingRef.current) return;
    flyingRef.current = true;
    const distance = direction === "right" ? FLY_OUT_DISTANCE_PX : -FLY_OUT_DISTANCE_PX;
    if (likeStampRef.current) likeStampRef.current.style.opacity = direction === "right" ? "1" : "0";
    if (nopeStampRef.current) nopeStampRef.current.style.opacity = direction === "left" ? "1" : "0";
    setTransform(distance, true);
    window.setTimeout(() => {
      if (direction === "right") onSwipeRight();
      else onSwipeLeft();
    }, 180);
  }

  useImperativeHandle(ref, () => ({
    like: () => flyOut("right"),
    nope: () => flyOut("left"),
  }));

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
        className="h-full select-none"
        // *** תוקן (Bug מפורש - "ההחלקה לא עובדת ימינה ושמאלה בטלפון"):
        // touch-action נקבע עכשיו ב-inline style, לא רק במחלקת Tailwind
        // (touch-pan-y/touch-none) - מאותה סיבה בדיוק שכבר תוקנה במקומות
        // אחרים בשיחה הזו: מחלקות Tailwind ספציפיות לא תמיד מתקמפלות/
        // נטענות באופן אמין בסביבת ה-build. touch-action הוא קריטי
        // למובייל בפרט - בלעדיו (או עם ערך שגוי), הדפדפן יכול "לתפוס"
        // את המחווה לגלילה רגילה במקום להעביר אותה ל-pointer events שלנו,
        // בדיוק התסמין שתואר (עובד בעכבר/דסקטופ, לא בטלפון עם מגע אמיתי).
        style={{ willChange: "transform", touchAction: allowVerticalScroll ? "pan-y" : "none" }}
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
});
