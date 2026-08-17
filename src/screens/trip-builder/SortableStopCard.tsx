"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { useDndContext } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { FinalItinerary, FinalItineraryStop } from "@/services/tripBuilder/types";

interface SortableStopCardProps {
  stop: FinalItineraryStop;
  sessionId: string | null;
  onItineraryUpdate: (itinerary: FinalItinerary) => void;
  /** אם לא מוגדר (undefined) - הכרטיס לא ניתן למחיקה בסוויפ (למשל תחנות
   *  סינתטיות כמו נחיתה/מלון, שאין להן שורה אמיתית למחוק, או מסלול עם
   *  תחנה בודדת - ר' הערה ב-draggable למטה). */
  onDelete?: () => void;
  /** ברירת מחדל true. false מסתיר לגמרי את ידית הגרירה (⠿) - משמש
   *  למסלולים עם תחנה בודדת, שם לגרירה/סידור מחדש אין משמעות אמיתית
   *  (אין לאן לסדר מחדש). גרירה+מחיקה זמינות החל מ-2 תחנות ומעלה, לפי
   *  בקשה מפורשת. "שינוי עם TRIPPY" תמיד נשאר זמין בלי קשר לזה - זו
   *  נקודת הכניסה לעריכה בכל מקרה, לא רק סידור/מחיקה. */
  draggable?: boolean;
  /** אם סופק - כל אזור התמונה+טקסט (לא ידית הגרירה/כפתור TRIPPY) הופך
   *  לקישור לעמוד האטרקציה המלא (/place/[id]). אופציונלי כדי לא לשבור
   *  שימושים קיימים בלי צורך אמיתי בניווט. */
  placeHref?: string;
}

const SWIPE_REVEAL_PX = 84;
// פס אדום קבוע ותמיד גלוי בקצה, גם במנוחה - עקבי עם שאר הכרטיסים
// באפליקציה (עמוד "הטיולים שלי", עמודי tripmatch) - עובי 3px בכולם.
const REST_PEEK_PX = 3;

function priceLevelSymbols(level: number | null): string | null {
  if (level == null) return null;
  return "₪".repeat(Math.max(1, level + 1));
}

/** כרטיס תחנה נקי ומעוצב, ניתן לגרירה (כשמתאים), עם נקודת כניסה אחת בלבד (TRIPPY) לשינויים. */
export function SortableStopCard({
  stop,
  sessionId,
  onItineraryUpdate,
  onDelete,
  draggable = true,
  placeHref,
}: SortableStopCardProps) {
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

  // מצב הסוויפ - "כמה נגרר כרגע שמאלה" (0 עד +SWIPE_REVEAL_PX) ואם הפאנל
  // פתוח (חשוף) כרגע. הפאנל בצד ימין של הכרטיס, נחשף בגרירה שמאלה - עקבי
  // עם המחיקה בשאר העמודים באפליקציה (ר' SwipeToDeleteRow.tsx).
  const [swipeX, setSwipeX] = useState(onDelete ? REST_PEEK_PX : 0);
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
    swipeStartOffset.current = swipeOpen ? SWIPE_REVEAL_PX : REST_PEEK_PX;
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

    const next = Math.max(REST_PEEK_PX, Math.min(SWIPE_REVEAL_PX, swipeStartOffset.current - deltaX));
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
    setSwipeX(shouldOpen ? SWIPE_REVEAL_PX : REST_PEEK_PX);
  }

  function handleConfirmDelete() {
    setSwipeOpen(false);
    setSwipeX(REST_PEEK_PX);
    onDelete?.();
  }

  // אם התחיל דראג-סידור באמצע סוויפ שלא הושלם (לא "ננעל" פתוח/סגור) - מבטלים
  // אותו לגמרי, כדי שלא יישאר במצב חלקי/מוזר ויזואלית.
  useEffect(() => {
    if (isAnyDragActive && !swipeOpen) {
      swipeStartX.current = null;
      swipeStartY.current = null;
      swipeDirection.current = null;
      setSwipeX(onDelete ? REST_PEEK_PX : 0);
    }
  }, [isAnyDragActive, swipeOpen, onDelete]);

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
    <div ref={setNodeRef} style={dndStyle} className="relative overflow-hidden rounded-card">
      {/* פאנל המחיקה - נחשף כשגוררים (סוויפ) את הכרטיס שמאלה, בדיוק כמו
          המחיקה בשאר העמודים באפליקציה (SwipeToDeleteRow.tsx) - בצד ימין
          של הכרטיס. מוצג תמיד כש-onDelete קיים (לא רק תוך כדי סוויפ) -
          כדי שפס ה"הצצה" הקבוע (REST_PEEK_PX) יהיה גלוי גם במנוחה, לא
          רק כשגוררים בפועל. */}
      {onDelete && (
        <div
          className="absolute inset-y-0 flex items-stretch"
          style={{ width: SWIPE_REVEAL_PX, right: 0 }}
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

      {/* תוכן הכרטיס בפועל - מקבל רק את הטרנספורם של הסוויפ (translateX
          שלילי, לחשיפת פאנל המחיקה בצד ימין) - נפרד לגמרי מהטרנספורם של
          dnd-kit שעל העטיפה החיצונית. עיצוב הרקע/הצבעים זהה לכרטיס
          האטרקציה בעמוד "הטיולים שלי" (bg-bg-secondary/rounded-card),
          לפי בקשה מפורשת - לא הלבן/צל הקודם. */}
      <div
        style={{ transform: swipeX !== 0 ? `translateX(${-swipeX}px)` : undefined, touchAction: "pan-y" }}
        onPointerDown={handleSwipePointerDown}
        onPointerMove={handleSwipePointerMove}
        onPointerUp={handleSwipePointerUp}
        onPointerCancel={handleSwipePointerUp}
        className="relative overflow-hidden rounded-card bg-bg-secondary"
      >
        <div className="flex gap-3 p-3">
          {placeHref ? (
            <Link href={placeHref} className="flex min-w-0 flex-1 gap-3">
              {stop.imageUrls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stop.imageUrls[0]} alt={stop.name} className="h-20 w-24 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="h-20 w-24 shrink-0 rounded-xl bg-bg-secondary" />
              )}

              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p className="truncate text-[15px] font-bold text-ink">{stop.name}</p>

                {stop.shortDescription && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-secondary">{stop.shortDescription}</p>
                )}

                <div className="mt-auto flex items-center gap-3 pt-1.5 text-xs text-ink-secondary">
                  {stop.rating != null && <span>⭐ {stop.rating}</span>}
                  {price && <span className="text-ink-secondary/80">{price}</span>}
                </div>
              </div>
            </Link>
          ) : (
            <>
              {stop.imageUrls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stop.imageUrls[0]} alt={stop.name} className="h-20 w-24 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="h-20 w-24 shrink-0 rounded-xl bg-bg-secondary" />
              )}

              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p className="truncate text-[15px] font-bold text-ink">{stop.name}</p>

                {stop.shortDescription && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-secondary">{stop.shortDescription}</p>
                )}

                <div className="mt-auto flex items-center gap-3 pt-1.5 text-xs text-ink-secondary">
                  {stop.rating != null && <span>⭐ {stop.rating}</span>}
                  {price && <span className="text-ink-secondary/80">{price}</span>}
                </div>
              </div>
            </>
          )}

          {/* ידית גרירה - מעל התמונה, לא מתנגשת עם דבר. data-no-swipe אומר
              למנגנון הסוויפ להתעלם לגמרי מנגיעות שמתחילות כאן. מוצגת רק
              כש-draggable=true (למסלולים עם יותר מ-2 תחנות) - לגרירה של
              תחנה יחידה/זוגית אין משמעות אמיתית. */}
          {draggable && (
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
          )}

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
          <div className="flex items-center gap-2 border-t border-ink-secondary/10 bg-white/70 p-2.5">
            <button
              type="button"
              onClick={() => setInstructOpen(false)}
              className="shrink-0 text-lg leading-none text-ink-secondary/60"
              aria-label="סגור"
            >
              ✕
            </button>
            <input
              type="text"
              value={instructText}
              onChange={(e) => setInstructText(e.target.value)}
              placeholder="כתבו מה תרצו לשנות..."
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
