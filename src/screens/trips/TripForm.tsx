"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TRIP_LIMITS, formatStopNumber, type TripTypeId } from "@/services/social/tripTypes";
import type { PostVisibility } from "@/services/social/types";
import { CollectionCover } from "@/screens/collections/CollectionCover";
import { CollectionItemPickerSheet } from "@/screens/collections/CollectionItemPickerSheet";
import { CoverPickerSheet } from "@/screens/collections/CoverPickerSheet";
import { VisibilityChips } from "@/screens/collections/VisibilityChips";
import type { CollectionFormItem } from "@/screens/collections/collectionFormTypes";
import { Button } from "@/components/ui";
import {
  ActionRow,
  CREATE_BLUE,
  CloseIcon,
  CreatePageHeader,
  ErrorBox,
  FIELD_CLASS,
  FieldLabel,
  GripIcon,
  ImageIcon,
  OptionalTag,
  PinIcon,
  PlusIcon,
  Svg,
  TEXTAREA_CLASS,
} from "@/screens/create/CreateUi";
import { TRIP_DRAFT_KEY } from "@/screens/collections/createDrafts";
const DRAFT_KEY = TRIP_DRAFT_KEY;
/** *** תוספת (בקשה מפורשת - "אם לא מצאתי מקום, אל תחזיר אותי אחורה לעמוד 'מקום' - תן לי להוסיף
 *  בטיול עצמו כבר"): שני מפתחות session נפרדים מ-DRAFT_KEY (שקיים רק ב-create) - אלה עובדים גם
 *  ב-edit, כי הם לא "טיוטת טופס מלאה" אלא רק "לאיזה יום להוסיף" ו"איזה מקום נוצר/נבחר בדרך".
 *  places/create/page.tsx כותב ל-NEW_PLACE_KEY ממש לפני שהוא מנווט חזרה לכאן (returnTo). */
const PENDING_DAY_KEY = "trip_add_place_pending_day_v1";
const NEW_PLACE_KEY = "trip_new_place_v1";

const TITLE_EXAMPLES = ["יום מושלם בירושלים", "סופ״ש בגליל", "טיול שקיעה בים המלח", "3 ימים בצפון"];

/** תחנה בטופס: Place + הערה. הסדר = המיקום ברשימה של היום; היום = באיזה יום היא נמצאת. */
export interface TripFormStop {
  key: string;
  placeId: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  note: string;
}

export interface TripFormDay {
  id: string;
  stops: TripFormStop[];
}

export interface TripFormInitial {
  title: string;
  description: string;
  coverUrl: string | null;
  tripType: TripTypeId | null;
  visibility: PostVisibility;
  days: TripFormDay[];
}

interface TripFormProps {
  mode: "create" | "edit";
  tripId?: string;
  initial?: TripFormInitial;
}

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function newTripFormStop(fields: Omit<TripFormStop, "key">): TripFormStop {
  return { key: newId("stop"), ...fields };
}

function SortableStopRow({
  stop,
  number,
  dayNumber,
  dayCount,
  onRemove,
  onNoteChange,
  onMoveToDay,
}: {
  stop: TripFormStop;
  number: number;
  dayNumber: number;
  dayCount: number;
  onRemove: () => void;
  onNoteChange: (note: string) => void;
  onMoveToDay: (targetDay: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.key });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.9 : 1 };

  return (
    <li ref={setNodeRef} style={style} className={`rounded-[20px] bg-[#F7F8FA] p-2.5 ${isDragging ? "shadow-[0_12px_28px_-10px_rgba(15,20,25,0.3)]" : ""}`}>
      <div className="flex items-center gap-2">
        {/* ידית גרירה בלבד (לא כל הכרטיס) - כדי שגלילת העמוד במובייל לא תתנגש עם הגרירה */}
        <button
          type="button"
          aria-label="גרירה לשינוי סדר"
          {...attributes}
          {...listeners}
          style={{ touchAction: "none" }}
          className="flex h-10 w-6 shrink-0 cursor-grab items-center justify-center text-[#b3b9c3] active:cursor-grabbing"
        >
          <GripIcon />
        </button>
        {/* התמונה עם מספר התחנה עליה - המספר מתעדכן אוטומטית כשהסדר משתנה */}
        <span className="relative h-14 w-14 shrink-0">
          <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-[14px] bg-[#EFF1F4] text-[#9aa1ad]">
            {stop.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stop.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <PinIcon />
            )}
          </span>
          <span
            className="absolute -top-1.5 -start-1.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11.5px] font-bold tabular-nums text-white ring-2 ring-[#F7F8FA]"
            style={{ background: CREATE_BLUE }}
          >
            {formatStopNumber(number)}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{stop.title}</span>
          {stop.subtitle && <span className="block truncate text-[12.5px] text-ink-secondary">{stop.subtitle}</span>}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="הסרה"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-ink-secondary shadow-[0_1px_3px_rgba(15,20,25,0.12)] active:scale-90"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={stop.note}
          onChange={(e) => onNoteChange(e.target.value)}
          maxLength={TRIP_LIMITS.maxNote}
          placeholder="הערה (למשל: להגיע לפני 10:00)"
          className="h-10 min-w-0 flex-1 rounded-full bg-white px-4 text-[14px] text-ink placeholder:text-[#9aa1ad] focus:outline-none focus:ring-2 focus:ring-[#0A6DFE]/30"
        />
        {dayCount > 1 && (
          <label className="relative flex h-10 shrink-0 items-center">
            <select
              value={dayNumber}
              onChange={(e) => onMoveToDay(Number(e.target.value))}
              aria-label="העברה ליום אחר"
              className="h-10 appearance-none rounded-full bg-white pe-8 ps-3.5 text-[13px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-[#0A6DFE]/30"
            >
              {Array.from({ length: dayCount }, (_, i) => (
                <option key={i} value={i + 1}>
                  יום {i + 1}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute end-3 text-ink-secondary">
              <Svg size={12}>
                <path d="m6 9 6 6 6-6" />
              </Svg>
            </span>
          </label>
        )}
      </div>
    </li>
  );
}

/**
 * טופס יצירה/עריכה של טיול (משותף). שם (חובה) · תיאור · Cover · סוג טיול (אופציונלי) ·
 * תחנות בסדר (Drag & Drop, מספור אוטומטי) עם חלוקה לימים · פרטיות.
 * מהיר בכוונה: מספיק שם + 2 תחנות כדי לפרסם; כל השאר אופציונלי. טיול של יום אחד = יום אחד בלי כותרות יום.
 */
export function TripForm({ mode, tripId, initial }: TripFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [coverUrl, setCoverUrl] = useState<string | null>(initial?.coverUrl ?? null);
  const [tripType, setTripType] = useState<TripTypeId | null>(initial?.tripType ?? null);
  const [visibility, setVisibility] = useState<PostVisibility>(initial?.visibility ?? "public");
  const [days, setDays] = useState<TripFormDay[]>(initial?.days?.length ? initial.days : [{ id: newId("day"), stops: [] }]);
  const [pickerDay, setPickerDay] = useState<number | null>(null);
  const [coverSheetOpen, setCoverSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const allStops = days.flatMap((d) => d.stops);
  const stopCount = allStops.length;
  const stopImages = allStops.map((s) => s.imageUrl).filter((u): u is string => !!u);
  const canPublish = title.trim().length > 0 && stopCount >= TRIP_LIMITS.minStops && !submitting;
  const multiDay = days.length > 1;

  // שחזור חד-פעמי של טיוטה: אם יצאנו לזרימת "הוספת מקום" הקיימת (לא יוצרים Place מתוך הטיול) וחזרנו.
  // רק ב-create - ב-edit הבסיס הוא ה-initial שהגיע מהשרת (הטיול האמיתי), לא טיוטה מקומית.
  useEffect(() => {
    if (mode !== "create") return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(DRAFT_KEY);
      const draft = JSON.parse(raw) as TripFormInitial;
      setTitle(draft.title);
      setDescription(draft.description);
      setCoverUrl(draft.coverUrl);
      setTripType(draft.tripType);
      setVisibility(draft.visibility);
      if (draft.days?.length) setDays(draft.days);
    } catch {
      // טיוטה פגומה - מתעלמים
    }
  }, [mode]);

  // *** תוספת (בקשה מפורשת - "אם לא מצאתי מקום, כשאני כבר יוצר טיול - אל תחזיר אותי אחורה לעמוד
  // 'מקום' - תן לי להוסיף בטיול עצמו כבר"): רץ תמיד (גם ב-edit, לא רק create) - אם חזרנו מ-
  // places/create עם מקום שזה עתה נוצר/נבחר (NEW_PLACE_KEY, ר' ההערה שם), הוא מתווסף אוטומטית
  // כתחנה ליום שממנו פתחנו את "הוסיפו אותו ל-TRIPLACE" (PENDING_DAY_KEY) - בלי לחפש אותו שוב.
  // רץ *אחרי* effect השחזור למעלה (סדר ה-hooks בקומפוננטה) - כך שב-create, ה-setDays הפונקציונלי
  // כאן פועל כבר על גבי days המשוחזרים, לא דורס אותם.
  useEffect(() => {
    try {
      const rawPlace = sessionStorage.getItem(NEW_PLACE_KEY);
      if (!rawPlace) return;
      sessionStorage.removeItem(NEW_PLACE_KEY);
      const place = JSON.parse(rawPlace) as { id: string; name: string; subtitle: string | null; imageUrl: string | null };
      let dayIndex = 0;
      try {
        const rawDay = sessionStorage.getItem(PENDING_DAY_KEY);
        sessionStorage.removeItem(PENDING_DAY_KEY);
        if (rawDay != null) dayIndex = Number(rawDay) || 0;
      } catch {
        // אין יעד ידוע - נופלים ליום הראשון
      }
      setDays((prev) => {
        if (prev.some((d) => d.stops.some((s) => s.placeId === place.id))) return prev; // כבר נוסף
        const targetIndex = Math.min(Math.max(dayIndex, 0), prev.length - 1);
        return prev.map((day, i) =>
          i === targetIndex
            ? { ...day, stops: [...day.stops, newTripFormStop({ placeId: place.id, title: place.name, subtitle: place.subtitle, imageUrl: place.imageUrl, note: "" })] }
            : day
        );
      });
    } catch {
      // מידע פגום - מתעלמים
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGoAddPlace() {
    if (mode === "create") {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, coverUrl, tripType, visibility, days }));
      } catch {
        // sessionStorage חסום - ממשיכים בלי טיוטה
      }
    }
    try {
      sessionStorage.setItem(PENDING_DAY_KEY, String(pickerDay ?? 0));
    } catch {
      // sessionStorage חסום - המקום פשוט לא יתווסף אוטומטית בחזרה
    }
    const returnTo = mode === "edit" && tripId ? `/places/trip/${tripId}/edit` : "/places/trip/create";
    router.push(`/places/create?returnTo=${encodeURIComponent(returnTo)}`);
  }

  function handleDragEnd(dayIndex: number, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIndex) return day;
        const from = day.stops.findIndex((s) => s.key === active.id);
        const to = day.stops.findIndex((s) => s.key === over.id);
        // גרירה מעל תחנה של יום אחר - מתעלמים (העברה בין ימים נעשית דרך הבורר "יום N" בכל תחנה)
        return from < 0 || to < 0 ? day : { ...day, stops: arrayMove(day.stops, from, to) };
      })
    );
  }

  function handleAddStop(dayIndex: number, item: CollectionFormItem) {
    setDays((prev) => {
      if (prev.flatMap((d) => d.stops).length >= TRIP_LIMITS.maxStops) return prev;
      if (prev.some((d) => d.stops.some((s) => s.placeId === item.refId))) return prev;
      return prev.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              stops: [...day.stops, newTripFormStop({ placeId: item.refId, title: item.title, subtitle: item.subtitle, imageUrl: item.imageUrl, note: "" })],
            }
          : day
      );
    });
  }

  function handleRemoveStop(dayIndex: number, key: string) {
    setDays((prev) => prev.map((day, i) => (i === dayIndex ? { ...day, stops: day.stops.filter((s) => s.key !== key) } : day)));
  }

  function handleNote(dayIndex: number, key: string, note: string) {
    setDays((prev) => prev.map((day, i) => (i === dayIndex ? { ...day, stops: day.stops.map((s) => (s.key === key ? { ...s, note } : s)) } : day)));
  }

  function handleMoveToDay(fromDay: number, key: string, targetDayNumber: number) {
    const targetIndex = targetDayNumber - 1;
    if (targetIndex === fromDay) return;
    setDays((prev) => {
      const stop = prev[fromDay]?.stops.find((s) => s.key === key);
      if (!stop || !prev[targetIndex]) return prev;
      return prev.map((day, i) => {
        if (i === fromDay) return { ...day, stops: day.stops.filter((s) => s.key !== key) };
        if (i === targetIndex) return { ...day, stops: [...day.stops, stop] };
        return day;
      });
    });
  }

  function handleAddDay() {
    setDays((prev) => (prev.length >= TRIP_LIMITS.maxDays ? prev : [...prev, { id: newId("day"), stops: [] }]));
  }

  /** הסרת יום: התחנות שלו עוברות ליום הקודם (או לבא, אם זה היום הראשון) - לא מאבדים תחנות בטעות. */
  function handleRemoveDay(dayIndex: number) {
    setDays((prev) => {
      if (prev.length <= 1) return prev;
      const receiver = dayIndex > 0 ? dayIndex - 1 : 1;
      const moved = prev[dayIndex].stops;
      return prev
        .map((day, i) => (i === receiver ? { ...day, stops: dayIndex > 0 ? [...day.stops, ...moved] : [...moved, ...day.stops] } : day))
        .filter((_, i) => i !== dayIndex);
    });
  }

  async function handleSubmit() {
    if (!canPublish) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        coverUrl,
        tripType,
        visibility,
        days: days.map((day) => ({ stops: day.stops.map((s) => ({ placeId: s.placeId, note: s.note.trim() || null })) })),
      };
      const res =
        mode === "create"
          ? await fetch("/api/social/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
          : await fetch(`/api/social/trips/${tripId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "שגיאה בשמירת הטיול");
      // ?created=1 - עמוד הטיול מציג "יצרתם טיול 🎉"
      router.replace(mode === "create" ? `/places/trip/${data.id}?created=1` : `/places/trip/${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירת הטיול");
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!tripId || !window.confirm("למחוק את הטיול? הפעולה לא הפיכה.")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/social/trips/${tripId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("שגיאה במחיקת הטיול");
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה במחיקת הטיול");
      setSubmitting(false);
    }
  }

  const missing = TRIP_LIMITS.minStops - stopCount;

  /** השורה שמתחת ל"הוספת תחנה" - מה חסר כדי לפרסם, או טיפ על גרירה. */
  function addStopHint(dayStops: number): string | undefined {
    if (missing > 0) return `כדי לפרסם צריך לפחות ${TRIP_LIMITS.minStops} תחנות${stopCount > 0 ? ` - עוד ${missing}` : ""}`;
    if (dayStops > 1) return "אפשר לגרור כדי לשנות סדר";
    return undefined;
  }

  return (
    <div className="mx-auto max-w-xl px-5 pb-12 pt-4">
      {/* *** עיצוב מחדש (בקשה מפורשת - "נתאים לעיצוב של האפליקציה"): אותה שפה כמו פוסט / מקום /
          חוויות - כותרת גדולה, שדות אפורים-בהירים בלי מסגרות, כחול לבחירה, והכפתור הראשי הקבוע. */}
      <CreatePageHeader
        title={mode === "create" ? "צרו את הטיול שלכם" : "עריכת טיול"}
        subtitle={mode === "create" ? "לאן יוצאים? שם, תחנות - וזהו" : "שנו תחנות, סדר או פרטים"}
      />

      <FieldLabel htmlFor="trip-title">שם הטיול</FieldLabel>
      <input
        id="trip-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={TRIP_LIMITS.maxTitle}
        placeholder="איך תקראו לטיול?"
        className={`${FIELD_CLASS} text-[16px]`}
      />
      {/* רעיונות לשם - לחיצה ממלאת את השדה. נעלמים ברגע שמתחילים לכתוב. */}
      {!title && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {TITLE_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setTitle(example)}
              className="h-8 rounded-full border border-black/[0.08] px-3 text-[13px] font-medium text-ink-secondary transition active:scale-95 active:bg-[#F1F2F5]"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        <FieldLabel htmlFor="trip-description">
          תיאור <OptionalTag />
        </FieldLabel>
        <textarea
          id="trip-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={TRIP_LIMITS.maxDescription}
          rows={3}
          placeholder="ספרו קצת על הטיול..."
          className={TEXTAREA_CLASS}
        />
      </div>

      {/* *** תיקון (בקשה מפורשת - "צריך להעלים את כל סוגי הטיול - זה לא רלוונטי! זה טיול!!"): הוסרה
          לגמרי בחירת "סוג הטיול". tripType עצמו נשאר null תמיד (לא נמחק מה-state/payload - כדי לא
          לשבור את סכימת ה-API), פשוט אין יותר UI לבחור אותו. */}

      <div className="mt-6">
        <FieldLabel>תמונת הטיול</FieldLabel>
        <div className="relative overflow-hidden rounded-[20px]">
          <CollectionCover coverUrl={coverUrl ?? stopImages[0] ?? null} collageUrls={[]} type="trips" className="aspect-[16/9]" />
          <button
            type="button"
            onClick={() => setCoverSheetOpen(true)}
            className="absolute bottom-2.5 end-2.5 flex h-9 items-center gap-1.5 rounded-full bg-black/55 px-3.5 text-[13px] font-semibold text-white backdrop-blur-sm active:scale-95"
          >
            <ImageIcon size={16} />
            החלפה
          </button>
        </div>
        <p className="mt-1.5 text-[12.5px] text-ink-secondary">{coverUrl ? "התמונה שבחרתם" : "נבחרת אוטומטית - התמונה של התחנה הראשונה"}</p>
      </div>

      <div className="mt-6">
        <div className="mb-1.5 flex items-baseline justify-between">
          <FieldLabel>תחנות</FieldLabel>
          {stopCount > 0 && <span className="text-[13px] font-medium tabular-nums text-ink-secondary">{stopCount}</span>}
        </div>

        <div className="flex flex-col gap-6">
          {days.map((day, dayIndex) => (
            <section key={day.id} aria-label={multiDay ? `יום ${dayIndex + 1}` : undefined}>
              {multiDay && (
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="flex items-baseline gap-2 text-[16px] font-bold text-ink">
                    יום {dayIndex + 1}
                    <span className="text-[13px] font-medium text-ink-secondary">
                      {day.stops.length === 1 ? "תחנה אחת" : `${day.stops.length} תחנות`}
                    </span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleRemoveDay(dayIndex)}
                    className="h-8 rounded-full bg-[#F1F2F5] px-3 text-[12.5px] font-semibold text-ink-secondary active:scale-95"
                  >
                    הסרת יום
                  </button>
                </div>
              )}

              {day.stops.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(dayIndex, e)}>
                  <SortableContext items={day.stops.map((s) => s.key)} strategy={verticalListSortingStrategy}>
                    <ul className="mb-2 flex flex-col gap-2">
                      {/* המספור מתחיל מ-01 מחדש בכל יום (כמו בעמוד הטיול) ומתעדכן אוטומטית עם הסדר */}
                      {day.stops.map((stop, position) => (
                        <SortableStopRow
                          key={stop.key}
                          stop={stop}
                          number={position}
                          dayNumber={dayIndex + 1}
                          dayCount={days.length}
                          onRemove={() => handleRemoveStop(dayIndex, stop.key)}
                          onNoteChange={(note) => handleNote(dayIndex, stop.key, note)}
                          onMoveToDay={(target) => handleMoveToDay(dayIndex, stop.key, target)}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}

              <ActionRow
                icon={<PinIcon />}
                title={multiDay ? `הוספת תחנה ליום ${dayIndex + 1}` : "הוספת תחנה"}
                subtitle={addStopHint(day.stops.length)}
                disabled={stopCount >= TRIP_LIMITS.maxStops}
                onClick={() => setPickerDay(dayIndex)}
              />
            </section>
          ))}
        </div>

        {days.length < TRIP_LIMITS.maxDays && (
          <button
            type="button"
            onClick={handleAddDay}
            className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold transition active:bg-[#F1F2F5]"
            style={{ color: CREATE_BLUE }}
          >
            <PlusIcon size={18} />
            {multiDay ? "הוספת יום" : "טיול של כמה ימים? הוסיפו יום"}
          </button>
        )}
      </div>

      <div className="mt-6">
        <FieldLabel>מי יכול לראות?</FieldLabel>
        <VisibilityChips value={visibility} onChange={setVisibility} />
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      <Button type="button" fullWidth disabled={!canPublish} onClick={handleSubmit} className="mt-8">
        {submitting ? "שומרים..." : mode === "create" ? "פרסום טיול" : "שמירת שינויים"}
      </Button>

      {mode === "edit" && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={submitting}
          className="mt-2 h-11 w-full text-[14px] font-semibold text-[#C8373C] disabled:opacity-50"
        >
          מחיקת הטיול
        </button>
      )}

      {pickerDay !== null && (
        <CollectionItemPickerSheet
          type="places"
          heading="חפשו מקום להוסיף לטיול"
          addedKeys={new Set(allStops.map((s) => `place:${s.placeId}`))}
          onAdd={(item) => handleAddStop(pickerDay, item)}
          onClose={() => setPickerDay(null)}
          onGoAddPlace={handleGoAddPlace}
        />
      )}

      {coverSheetOpen && (
        <CoverPickerSheet
          coverUrl={coverUrl}
          imageUrls={stopImages}
          heading="בחירת תמונת הטיול"
          autoLabel="תמונה אוטומטית (התחנה הראשונה)"
          onSelect={(url) => {
            setCoverUrl(url);
            setCoverSheetOpen(false);
          }}
          onClose={() => setCoverSheetOpen(false)}
        />
      )}
    </div>
  );
}
