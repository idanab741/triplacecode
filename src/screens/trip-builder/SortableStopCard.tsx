"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { useDndContext } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { FinalItinerary, FinalItineraryStop } from "@/services/tripBuilder/types";

interface SortableStopCardProps {
  stop: FinalItineraryStop;
  sessionId: string | null;
  onItineraryUpdate: (itinerary: FinalItinerary) => void;
  /** אם לא מוגדר (undefined) - הכרטיס לא ניתן למחיקה בסוויפ (למשל תחנות
   *  סינתטיות כמו נחיתה/מלון, שאין להן שורה אמיתית למחוק). */
  onDelete?: () => void;
}

const SWIPE_REVEAL_PX = 84;

function priceLevelSymbols(level: number | null): string | null {
  if (level == null) return null;
  return "₪".repeat(Math.max(1, level + 1));
}

/** כרטיס תחנה נקי ומעוצב, ניתן לגרירה, עם נקודת כניסה אחת בלבד (TRIPPY) לשינויים. */
export function SortableStopCard({ stop, sessionId, onItineraryUpdate, onDelete }: SortableStopCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.stopId });
  // active !== null כשאיזשהו כרטיס (לא בהכרח זה) נמצא כרגע באמצע גרירת-סידור.
  // בלי הבדיקה הזו, כשגוררים כרטיס אחד ו"עוברים" מעל כרטיסים אחרים, תנועת
  // האצבע הזו יכולה "לדלוף" גם למנגנון הסוויפ של הכרטיסים שעוברים לידם -
  // שני מנגנוני מחוות נפרדים על אותו כרטיס בלי בידוד מלא ביניהם.
  const { active } = useDndContext();
  const isAnyDragActive = active != null;

  const [instructOpen, setInstructOpen] = useState(false);
  const [instructText, setInstructText] = useState("");
  const [instructLoading, setInstructLoading] = useState(false);
  const [instructError, setInstructError] = useState<string | null>(null);

  // מצב הסוויפ - "כמה נגרר כרגע ימינה" (0 עד +SWIPE_REVEAL_PX) ואם הפאנל
  // פתוח (חשוף) כרגע. הפאנל בצד שמאל של הכרטיס, נחשף בגרירה ימינה - זו
  // התנועה הטבעית ב-RTL (בניגוד ל-LTR שבו גוררים שמאלה).
  const [swipeX, setSwipeX] = useState(0);
  const [swipeOpen, setSwipeOpen] = useState(false);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeStartOffset = useRef(0);
  // עד שמזהים אם זו בכלל תנועה אופקית (סוויפ) או אנכית (גלילה רגילה) -
  // בלי הנעילה הזו, כל נגיעה בכרטיס "תפסה" את הסמן מיד וחסמה גלילה טבעית,
  // מה שגרם לגלילה להרגיש לא חלקה/תקועה.
  const swipeDirection = useRef<"horizontal" | "vertical" | null>(null);

  function handleSwipePointerDown(e: React.PointerEvent) {
    if (!onDelete || isAnyDragActive) return;
    if ((e.target as HTMLElement).closest("[data-no-swipe]")) return;
    swipeStartX.current = e.clientX;
    swipeStartY.current = e.clientY;
    swipeStartOffset.current = swipeOpen ? SWIPE_REVEAL_PX : 0;
    swipeDirection.current = null;
    // בכוונה **לא** לוכדים את הסמן (setPointerCapture) כאן עדיין - רק ברגע
    // שמזהים תנועה אופקית ברורה. תפיסה מוקדמת מדי היא מה שחסם את הגלילה.
  }

  function handleSwipePointerMove(e: React.PointerEvent) {
    if (swipeStartX.current == null || swipeStartY.current == null || !onDelete || isAnyDragActive) return;
    const deltaX = e.clientX - swipeStartX.current;
    const deltaY = e.clientY - swipeStartY.current;

    if (swipeDirection.current == null) {
      // עדיין בתוך "אזור מת" קטן - לא מספיק תנועה כדי לדעת כיוון
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      swipeDirection.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      if (swipeDirection.current === "horizontal") {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
    }

    // תנועה אנכית - משאירים לגלילה הרגילה של הדף, לא נוגעים בכלום
    if (swipeDirection.current !== "horizontal") return;

    const next = Math.max(0, Math.min(SWIPE_REVEAL_PX, swipeStartOffset.current + deltaX));
    setSwipeX(next);
  }

  function handleSwipePointerUp() {
    if (swipeStartX.current == null) return;
    const wasHorizontal = swipeDirection.current === "horizontal";
    swipeStartX.current = null;
    swipeStartY.current = null;
    swipeDirection.current = null;
    if (!wasHorizontal) return;

    // "מקפיץ" לפתוח לגמרי או סגור לגמרי, לפי איזה יותר קרוב - לא משאיר
    // באמצע, בדיוק כמו הודעות SMS
    const shouldOpen = swipeX > SWIPE_REVEAL_PX / 2;
    setSwipeOpen(shouldOpen);
    setSwipeX(shouldOpen ? SWIPE_REVEAL_PX : 0);
  }

  function handleConfirmDelete() {
    setSwipeOpen(false);
    setSwipeX(0);
    onDelete?.();
  }

  // אם התחיל דראג-סידור באמצע סוויפ שלא הושלם (לא "ננעל" פתוח/סגור) - מבטלים
  // אותו לגמרי, כדי שלא יישאר במצב חלקי/מוזר ויזואלית.
  useEffect(() => {
    if (isAnyDragActive && !swipeOpen) {
      swipeStartX.current = null;
      swipeStartY.current = null;
      swipeDirection.current = null;
      setSwipeX(0);
    }
  }, [isAnyDragActive, swipeOpen]);

  async function submitInstruction(text: string) {
    if (!sessionId || !text.trim() || instructLoading) return;
    setInstructLoading(true);
    setInstructError(null);
    try {
      const response = await fetch(
        `/api/trip-builder/sessions/${sessionId}/stops/${stop.stopId}/instruct`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instruction: text }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "לא הצלחנו לבצע את השינוי");
      onItineraryUpdate(data.itinerary);
      setInstructOpen(false);
      setInstructText("");
    } catch (error) {
      setInstructError(error instanceof Error ? error.message : "לא הצלחנו לבצע את השינוי");
    } finally {
      setInstructLoading(false);
    }
  }

  const price = priceLevelSymbols(stop.priceLevel);

  // סגנון dnd-kit (מיקום/טרנספורם/מעבר של הגרירה לסידור מחדש) - על
  // ה-**עטיפה החיצונית** (עם ref={setNodeRef}), לא על תוכן הכרטיס הפנימי.
  // זה קריטי: dnd-kit צריך להזיז את **כל הבלוק** כיחידה אחת בזמן גרירה.
  // קודם ה-ref/הטרנספורם היו על האלמנט הפנימי בלבד - העטיפה החיצונית
  // (שקובעת את המשבצת ברשימה) נשארה במקום בלי לזוז, ורק התוכן הפנימי "ברח"
  // אחרי האצבע - מה שנראה כאילו התחנה נעלמה/נמחקה מהמקום שלה בזמן גרירה.
  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={dndStyle} className="relative overflow-hidden rounded-2xl">
      {/* פאנל המחיקה - נחשף כשגוררים (סוויפ) את הכרטיס שמאלה, כמו בהודעות SMS.
          מוצג ב-DOM **רק** כשבאמת יש סוויפ פעיל/פתוח - לא תמיד מתחת לכרטיס. */}
      {onDelete && (swipeX !== 0 || swipeOpen) && (
        <div
          className="absolute inset-y-0 flex items-stretch"
          style={{ width: SWIPE_REVEAL_PX, left: 0 }}
        >
          <button
            type="button"
            onClick={handleConfirmDelete}
            className="flex flex-col items-center justify-center gap-1 bg-danger text-white"
            style={{ width: SWIPE_REVEAL_PX }}
            aria-label="מחק תחנה"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h10l1-13" />
            </svg>
            <span className="text-[10px] font-semibold">מחק</span>
          </button>
        </div>
      )}

      {/* תוכן הכרטיס בפועל (הבלוק הלבן) - מקבל רק את הטרנספורם של הסוויפ
          (translateX, לחשיפת פאנל המחיקה) - נפרד לגמרי מהטרנספורם של
          dnd-kit שעל העטיפה החיצונית. */}
      <div
        style={{ transform: swipeX !== 0 ? `translateX(${swipeX}px)` : undefined, touchAction: "pan-y" }}
        onPointerDown={handleSwipePointerDown}
        onPointerMove={handleSwipePointerMove}
        onPointerUp={handleSwipePointerUp}
        onPointerCancel={handleSwipePointerUp}
        className="relative overflow-hidden rounded-2xl bg-white shadow-soft"
      >
        <div className="flex gap-3 p-3">
          {stop.imageUrls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stop.imageUrls[0]} alt={stop.name} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="h-24 w-24 shrink-0 rounded-xl bg-bg-secondary" />
          )}

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="truncate text-[15px] font-semibold text-ink">{stop.name}</p>

            {stop.shortDescription && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-secondary">{stop.shortDescription}</p>
            )}

            <div className="mt-auto flex items-center gap-3 pt-1.5 text-xs text-ink-secondary">
              {stop.rating != null && <span>⭐ {stop.rating}</span>}
              {price && <span className="text-ink-secondary/80">{price}</span>}
            </div>
          </div>

          {/* ידית גרירה - מעל התמונה, לא מתנגשת עם דבר. data-no-swipe אומר
              למנגנון הסוויפ להתעלם לגמרי מנגיעות שמתחילות כאן. */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            data-no-swipe
            className="absolute right-4 top-4 flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-full bg-white/90 text-sm text-ink-secondary/60 shadow-sm backdrop-blur active:cursor-grabbing"
            aria-label="גרור לשינוי סדר"
          >
            ⠿
          </button>

          {/* TRIPPY - נקודת הכניסה היחידה לשינוי התחנה. מוסתר כשהתיבה כבר פתוחה, כדי לא להתנגש איתה */}
          {!instructOpen && (
            <button
              type="button"
              onClick={() => setInstructOpen(true)}
              className="absolute bottom-1.5 left-1.5 flex shrink-0 items-center gap-1 rounded-pill bg-white/90 py-0.5 pl-2 pr-1 shadow-sm backdrop-blur"
              aria-label="שנה תחנה עם TRIPPY"
            >
              <Image src="/images/tripy.png" alt="" width={22} height={22} className="rounded-full" />
              <span className="text-[10px] font-medium text-ink-secondary">שנה</span>
            </button>
          )}
        </div>

        {instructOpen && (
          <div className="flex items-center gap-2 border-t border-ink-secondary/10 bg-bg-secondary/40 p-2.5">
            <button
              type="button"
              onClick={() => setInstructOpen(false)}
              className="shrink-0 text-lg leading-none text-ink-secondary/60"
              aria-label="סגור"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => submitInstruction("תחליף את התחנה הזו במשהו אחר")}
              disabled={instructLoading}
              className="shrink-0 rounded-pill border border-accent/30 bg-white px-2.5 py-2 text-[11px] font-medium text-accent disabled:opacity-50 whitespace-nowrap"
            >
              🔄 {instructLoading ? "מחליף..." : "החלף"}
            </button>
            <input
              type="text"
              value={instructText}
              onChange={(e) => setInstructText(e.target.value)}
              placeholder='או כתבו בדיוק מה תרצו לשנות...'
              className="min-w-0 flex-1 rounded-pill border border-ink-secondary/20 bg-white px-3 py-2 text-xs text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button
              type="button"
              onClick={() => submitInstruction(instructText)}
              disabled={instructLoading || !instructText.trim()}
              className="shrink-0 rounded-pill px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              שלח
            </button>
          </div>
        )}
        {instructError && <p className="px-3 pb-2 text-xs text-danger">{instructError}</p>}
      </div>
    </div>
  );
}
