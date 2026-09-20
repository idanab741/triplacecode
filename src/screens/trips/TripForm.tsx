"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { QUICK_CATEGORIES } from "@/constants/quickCategories";
import { TRIP_LIMITS, TRIP_TYPE_IDS, formatStopNumber, getTripTypeLabel, type TripTypeId } from "@/services/social/tripTypes";
import type { PostVisibility } from "@/services/social/types";
import { CollectionCover } from "@/screens/collections/CollectionCover";
import { CollectionItemPickerSheet } from "@/screens/collections/CollectionItemPickerSheet";
import { CoverPickerSheet } from "@/screens/collections/CoverPickerSheet";
import { VisibilityChips } from "@/screens/collections/VisibilityChips";
import type { CollectionFormItem } from "@/screens/collections/collectionFormTypes";

const PURPLE_GRADIENT = "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))";
const DRAFT_KEY = "trip_draft_v1";

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
    <li ref={setNodeRef} style={style} className="rounded-card bg-white p-2.5 shadow-soft ring-1 ring-black/5">
      <div className="flex items-center gap-2.5">
        {/* מספר התחנה - מתעדכן אוטומטית כשהסדר משתנה */}
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12.5px] font-extrabold text-white tabular-nums"
          style={{ background: PURPLE_GRADIENT }}
        >
          {formatStopNumber(number)}
        </span>
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-card bg-bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {stop.imageUrl && <img src={stop.imageUrl} alt="" className="h-full w-full object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-bold text-ink">{stop.title}</span>
          {stop.subtitle && <span className="block truncate text-[12px] text-ink-secondary">{stop.subtitle}</span>}
        </span>
        {/* ידית גרירה בלבד (לא כל הכרטיס) - כדי שגלילת העמוד במובייל לא תתנגש עם הגרירה */}
        <button
          type="button"
          aria-label="גרירה לשינוי סדר"
          {...attributes}
          {...listeners}
          style={{ touchAction: "none" }}
          className="flex h-9 w-8 shrink-0 cursor-grab items-center justify-center text-ink-secondary active:cursor-grabbing"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.7" />
            <circle cx="15" cy="6" r="1.7" />
            <circle cx="9" cy="12" r="1.7" />
            <circle cx="15" cy="12" r="1.7" />
            <circle cx="9" cy="18" r="1.7" />
            <circle cx="15" cy="18" r="1.7" />
          </svg>
        </button>
        <button type="button" onClick={onRemove} aria-label="הסרה" className="shrink-0 rounded-full p-2 text-ink-secondary hover:bg-black/[0.05]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={stop.note}
          onChange={(e) => onNoteChange(e.target.value)}
          maxLength={TRIP_LIMITS.maxNote}
          placeholder="הערה (למשל: להגיע לפני 10:00)"
          className="min-w-0 flex-1 rounded-pill bg-bg-secondary px-3.5 py-2 text-[13px] text-ink focus:outline-none"
        />
        {dayCount > 1 && (
          <select
            value={dayNumber}
            onChange={(e) => onMoveToDay(Number(e.target.value))}
            aria-label="העברה ליום אחר"
            className="shrink-0 rounded-pill bg-bg-secondary px-2.5 py-2 text-[12.5px] font-semibold text-ink focus:outline-none"
          >
            {Array.from({ length: dayCount }, (_, i) => (
              <option key={i} value={i + 1}>
                יום {i + 1}
              </option>
            ))}
          </select>
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

  function handleGoAddPlace() {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, coverUrl, tripType, visibility, days }));
    } catch {
      // sessionStorage חסום - ממשיכים בלי טיוטה
    }
    router.push("/places/create");
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
      router.replace("/places");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה במחיקת הטיול");
      setSubmitting(false);
    }
  }

  const missing = TRIP_LIMITS.minStops - stopCount;

  return (
    <div className="px-5 pb-12 pt-6">
      <h1 className="mb-1 text-[22px] font-extrabold leading-tight text-ink">{mode === "create" ? "צרו את הטיול שלכם" : "עריכת טיול"}</h1>
      {mode === "create" && <p className="mb-5 text-[14px] text-ink-secondary">לאן יוצאים?</p>}
      {mode === "edit" && <div className="mb-5" />}

      <label className="mb-1 block text-[13px] font-semibold text-ink-secondary">שם הטיול</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={TRIP_LIMITS.maxTitle}
        placeholder="שם הטיול"
        className="w-full rounded-card border border-ink-secondary/20 px-4 py-3 text-[16px] focus:outline-none"
        style={{ borderColor: title ? "var(--color-places-purple)" : undefined }}
      />
      <p className="mb-4 mt-1 text-[12px] text-ink-secondary">למשל: {TITLE_EXAMPLES.map((e) => `"${e}"`).join(" · ")}</p>

      <label className="mb-1 block text-[13px] font-semibold text-ink-secondary">תיאור (אופציונלי)</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={TRIP_LIMITS.maxDescription}
        rows={3}
        placeholder="ספרו קצת על הטיול..."
        className="mb-5 w-full resize-none rounded-card border border-ink-secondary/20 px-4 py-3 text-[15px] focus:outline-none"
      />

      <label className="mb-2 block text-[13px] font-semibold text-ink-secondary">סוג הטיול (אופציונלי)</label>
      <div className="mb-5 flex flex-wrap gap-2">
        {TRIP_TYPE_IDS.map((id) => {
          const selected = tripType === id;
          const icon = QUICK_CATEGORIES.find((c) => c.id === id)?.imageSrc;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => setTripType(selected ? null : id)}
              className={`flex items-center gap-1.5 rounded-pill py-1.5 pe-3.5 ps-2 text-[13px] font-semibold ${selected ? "text-white" : "bg-bg-secondary text-ink"}`}
              style={selected ? { background: "var(--color-places-purple)" } : undefined}
            >
              {icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={icon} alt="" className="h-5 w-5 object-contain" />
              )}
              {getTripTypeLabel(id)}
            </button>
          );
        })}
      </div>

      <label className="mb-2 block text-[13px] font-semibold text-ink-secondary">קאבר</label>
      <div className="mb-6 overflow-hidden rounded-2xl shadow-soft">
        <div className="relative">
          <CollectionCover coverUrl={coverUrl ?? stopImages[0] ?? null} collageUrls={[]} type="trips" className="aspect-[16/9]" />
          <button
            type="button"
            onClick={() => setCoverSheetOpen(true)}
            className="absolute bottom-2 end-2 rounded-pill bg-black/55 px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            החלפת קאבר
          </button>
        </div>
        <p className="bg-white px-3 py-2 text-[12px] text-ink-secondary">{coverUrl ? "קאבר שבחרתם" : "קאבר אוטומטי - התמונה של התחנה הראשונה"}</p>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <label className="text-[13px] font-semibold text-ink-secondary">תחנות ({stopCount})</label>
      </div>

      <div className="flex flex-col gap-5">
        {days.map((day, dayIndex) => {
          return (
            <section key={day.id}>
              {multiDay && (
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[15px] font-extrabold text-ink">יום {dayIndex + 1}</h2>
                  <button type="button" onClick={() => handleRemoveDay(dayIndex)} className="text-[12px] font-semibold text-ink-secondary">
                    הסרת יום
                  </button>
                </div>
              )}

              {day.stops.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(dayIndex, e)}>
                  <SortableContext items={day.stops.map((s) => s.key)} strategy={verticalListSortingStrategy}>
                    <ul className="mb-2.5 flex flex-col gap-2">
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

              <button
                type="button"
                onClick={() => setPickerDay(dayIndex)}
                disabled={stopCount >= TRIP_LIMITS.maxStops}
                className="w-full rounded-pill border-2 border-dashed py-3 text-[14px] font-bold disabled:opacity-50"
                style={{ borderColor: "var(--color-places-purple)", color: "var(--color-places-purple)" }}
              >
                + הוספת תחנה
              </button>
            </section>
          );
        })}
      </div>

      {missing > 0 && <p className="mt-2 text-center text-[12px] text-ink-secondary">כדי לפרסם צריך לפחות {TRIP_LIMITS.minStops} תחנות</p>}

      {days.length < TRIP_LIMITS.maxDays && (
        <button type="button" onClick={handleAddDay} className="mt-4 w-full py-2 text-center text-[13.5px] font-bold" style={{ color: "var(--color-places-purple)" }}>
          + הוספת יום
        </button>
      )}

      <label className="mb-2 mt-5 block text-[13px] font-semibold text-ink-secondary">מי יכול לראות?</label>
      <div className="mb-6">
        <VisibilityChips value={visibility} onChange={setVisibility} />
      </div>

      {error && <p className="mb-3 text-[12.5px] text-red-500">{error}</p>}

      <button
        type="button"
        disabled={!canPublish}
        onClick={handleSubmit}
        className="w-full rounded-pill py-3.5 text-[15px] font-bold text-white disabled:opacity-50"
        style={{ background: PURPLE_GRADIENT }}
      >
        {submitting ? "שומרים..." : mode === "create" ? "פרסום טיול" : "שמירת שינויים"}
      </button>

      {mode === "edit" && (
        <button type="button" onClick={handleDelete} disabled={submitting} className="mt-3 w-full py-2.5 text-[13.5px] font-bold text-red-500 disabled:opacity-50">
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
          autoLabel="קאבר אוטומטי (התחנה הראשונה)"
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
