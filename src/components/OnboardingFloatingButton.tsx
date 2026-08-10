"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isMainOnboardingComplete } from "@/services/profile/profileService";
import { isPreferencesComplete } from "@/services/preferences/preferencesService";

/** גודל הכפתור בפיקסלים (עיגול). */
const SIZE = 84;
/** מרחק מינימלי מקצוות המסך, כדי שהכפתור לא "ייתקע" מתחת לפס הסטטוס/הבית. */
const EDGE_MARGIN = 10;
/** תזוזה גדולה מזו (בפיקסלים) נחשבת גרירה ולא לחיצה. */
const DRAG_THRESHOLD_PX = 6;
/** מפתח לשמירת המיקום האחרון שהמשתמש גרר אליו את הכפתור, כדי שהוא יישאר שם. */
const POSITION_STORAGE_KEY = "triplace_onboarding_fab_pos";

/** נתיבים שבהם אין להציג את הכפתור - כי המשתמש כבר נמצא בתוך תהליך ההרשמה/אונבורדינג
 *  עצמו, או במסך שקודם לו (auth/register-required), ואין טעם להציג לו הפניה לשם. */
const HIDDEN_ON_PREFIXES = [
  "/onboarding",
  "/preferences",
  "/profile-setup",
  "/auth",
  "/register-required",
  "/terms",
];

type Position = { x: number; y: number };

function defaultPosition(): Position {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return {
    x: window.innerWidth - SIZE - EDGE_MARGIN,
    // מעל בר הניווט התחתון (כ-72px) + שוליים
    y: window.innerHeight - SIZE - 96,
  };
}

function clampPosition(pos: Position): Position {
  if (typeof window === "undefined") return pos;
  const maxX = window.innerWidth - SIZE - EDGE_MARGIN;
  const maxY = window.innerHeight - SIZE - EDGE_MARGIN;
  return {
    x: Math.min(Math.max(pos.x, EDGE_MARGIN), Math.max(maxX, EDGE_MARGIN)),
    y: Math.min(Math.max(pos.y, EDGE_MARGIN), Math.max(maxY, EDGE_MARGIN)),
  };
}

/** אחרי גרירה, "מדביקים" את הכפתור לצד הקרוב יותר (ימין/שמאל) של המסך -
 *  כמו בועת צ'אט של מסנג'ר - כדי שהוא תמיד יהיה צמוד לשוליים ולא ישאר
 *  מרחף באמצע התוכן ומפריע לקריאה. הציר האנכי (y) נשאר איפה שהמשתמש שחרר. */
function snapToEdge(pos: Position): Position {
  if (typeof window === "undefined") return pos;
  const clamped = clampPosition(pos);
  const centerX = clamped.x + SIZE / 2;
  const isCloserToRight = centerX > window.innerWidth / 2;
  const maxX = window.innerWidth - SIZE - EDGE_MARGIN;
  return {
    x: isCloserToRight ? Math.max(maxX, EDGE_MARGIN) : EDGE_MARGIN,
    y: clamped.y,
  };
}

/** כפתור צף וניתן לגרירה, שמופיע בכל האפליקציה למשתמש מחובר שעדיין לא השלים
 *  את האונבורדינג הראשי ו/או את אשף ההעדפות. לחיצה עליו (בלי גרירה) מפנה אותו
 *  ישר למסך הרלוונטי שנשאר לו להשלים. המיקום נשמר ב-localStorage כך שהכפתור
 *  נשאר במקום שבו המשתמש השאיר אותו, גם אחרי ניווט/רענון. */
export function OnboardingFloatingButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, profile, profileLoading, preferences, preferencesLoading } = useAuth();

  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);

  const hiddenByRoute = HIDDEN_ON_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  const dataReady = !loading && !profileLoading && !preferencesLoading && Boolean(user);
  const needsOnboarding = dataReady && !isMainOnboardingComplete(profile);
  const needsPreferences = dataReady && !needsOnboarding && !isPreferencesComplete(preferences);
  const shouldShow = !hiddenByRoute && dataReady && (needsOnboarding || needsPreferences);

  // מיקום התחלתי: מהזיכרון אם קיים (עם clamp למקרה שגודל המסך השתנה), אחרת פינה ברירת מחדל.
  useEffect(() => {
    if (position || typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(POSITION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Position;
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPosition(snapToEdge(parsed));
          return;
        }
      }
    } catch {
      // localStorage לא זמין/פגום - נתעלם ונשתמש בברירת המחדל
    }
    setPosition(defaultPosition());
  }, [position]);

  // אם המסך משנה גודל (סיבוב מסך וכו'), נוודא שהכפתור נשאר בתוך התחום הנראה.
  useEffect(() => {
    function handleResize() {
      setPosition((prev) => (prev ? clampPosition(prev) : prev));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const state = dragState.current;
    if (!state) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      state.moved = true;
    }
    if (state.moved) {
      setPosition(clampPosition({ x: state.originX + dx, y: state.originY + dy }));
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    const state = dragState.current;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    setDragging(false);

    if (state?.moved) {
      // הייתה גרירה אמיתית - מדביקים לשוליים הקרובים ושומרים את המיקום, בלי לנווט.
      setPosition((prev) => {
        if (!prev) return prev;
        const snapped = snapToEdge(prev);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(snapped));
          } catch {
            // מתעלמים - שמירת מיקום היא נוחות, לא קריטית
          }
        }
        return snapped;
      });
    } else {
      // לחיצה רגילה (בלי גרירה) - ניווט למסך הרלוונטי.
      router.push(needsOnboarding ? "/onboarding" : "/preferences");
    }
    dragState.current = null;
  }, [handlePointerMove, router, needsOnboarding]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!position) return;
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: position.x,
        originY: position.y,
        moved: false,
      };
      setDragging(true);
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [position, handlePointerMove, handlePointerUp]
  );

  // ניקוי מאזינים אם הקומפוננטה יורדת באמצע גרירה
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  if (!shouldShow || !position) return null;

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      aria-label={needsOnboarding ? "השלימו את ההרשמה" : "השלימו את ההעדפות שלכם"}
      title={needsOnboarding ? "השלימו את ההרשמה" : "השלימו את ההעדפות שלכם"}
      className="fixed z-50 rounded-full shadow-soft active:scale-95 touch-none select-none"
      style={{
        left: position.x,
        top: position.y,
        width: SIZE,
        height: SIZE,
        cursor: dragging ? "grabbing" : "grab",
        transition: dragging ? "none" : "left 220ms ease, top 220ms ease, transform 150ms ease",
      }}
    >
      <span className="relative block h-full w-full">
        <Image
          src="/images/onboarding-fab.png"
          alt=""
          fill
          sizes={`${SIZE}px`}
          className="object-contain pointer-events-none animate-[fab-pulse_2.2s_ease-in-out_infinite]"
          draggable={false}
          priority
        />
      </span>
    </button>
  );
}
