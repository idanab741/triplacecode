"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { COLLECTION_LIMITS, COLLECTION_TYPE_LABELS, type CollectionType, type CollectionVisibility } from "@/services/social/collectionTypes";
import { CollectionCover } from "./CollectionCover";
import { CollectionItemPickerSheet } from "./CollectionItemPickerSheet";
import { CoverPickerSheet } from "./CoverPickerSheet";
import { VisibilityChips } from "./VisibilityChips";
import { toItemInputs, type CollectionFormItem } from "./collectionFormTypes";

const PURPLE_GRADIENT = "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))";
const DRAFT_KEY = "collection_draft_v1";

const TITLE_EXAMPLES: Record<CollectionType, string[]> = {
  places: ["עגלות הקפה שאסור לפספס", "המסעדות האהובות עליי", "מקומות לדייט"],
  trips: ["טיולי סופ״ש בארץ", "הטיולים שאני רוצה לעשות", "הטיולים הכי יפים שעשיתי"],
};

export interface CollectionFormInitial {
  title: string;
  description: string;
  coverUrl: string | null;
  visibility: CollectionVisibility;
  items: CollectionFormItem[];
}

interface CollectionFormProps {
  mode: "create" | "edit";
  type: CollectionType;
  collectionId?: string;
  initial?: CollectionFormInitial;
  /** *** תוספת (בקשה מפורשת): כשהאוסף נוצר מתוך עמוד "תוכן" השחור - פופאפ "מה תרצו
   *  להוסיף?" בלבד נפתח כהה, כדי להתאים לזרימה שממנה הגיעו. שום דבר אחר בטופס/בעמוד
   *  לא משתנה (לא הרקע, לא הבר העליון, אין בר תחתון) - בדיוק כמו תמיד. ברירת מחדל false. */
  dark?: boolean;
}

function SortableItemRow({
  item,
  onRemove,
  onNoteChange,
}: {
  item: CollectionFormItem;
  onRemove: (key: string) => void;
  onNoteChange: (key: string, note: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.9 : 1 };

  return (
    <li ref={setNodeRef} style={style} className="rounded-card bg-white p-2.5 shadow-soft ring-1 ring-black/5">
      <div className="flex items-center gap-2.5">
        {/* ידית גרירה בלבד (לא כל הכרטיס) - כדי שגלילת העמוד במובייל לא תתנגש עם הגרירה */}
        <button
          type="button"
          aria-label="גרירה לשינוי סדר"
          {...attributes}
          {...listeners}
          style={{ touchAction: "none" }}
          className="flex h-9 w-7 shrink-0 cursor-grab items-center justify-center text-ink-secondary active:cursor-grabbing"
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
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-card bg-bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.imageUrl && <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-bold text-ink">{item.title}</span>
          {item.subtitle && <span className="block truncate text-[12px] text-ink-secondary">{item.subtitle}</span>}
        </span>
        <button type="button" onClick={() => onRemove(item.key)} aria-label="הסרה" className="shrink-0 rounded-full p-2 text-ink-secondary hover:bg-black/[0.05]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <input
        value={item.note}
        onChange={(e) => onNoteChange(item.key, e.target.value)}
        maxLength={COLLECTION_LIMITS.maxNote}
        placeholder="הערה קצרה (אופציונלי)"
        className="mt-2 w-full rounded-pill bg-bg-secondary px-3.5 py-2 text-[13px] text-ink focus:outline-none"
      />
    </li>
  );
}

/** טופס יצירה/עריכה של אוסף (משותף). כותרת (חובה) · תיאור · Cover · פריטים (לפחות 2, גרירה לסדר) · פרטיות. */
export function CollectionForm({ mode, type, collectionId, initial, dark = false }: CollectionFormProps) {
  const router = useRouter();
  const labels = COLLECTION_TYPE_LABELS[type];

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [coverUrl, setCoverUrl] = useState<string | null>(initial?.coverUrl ?? null);
  const [visibility, setVisibility] = useState<CollectionVisibility>(initial?.visibility ?? "public");
  const [items, setItems] = useState<CollectionFormItem[]>(initial?.items ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [coverSheetOpen, setCoverSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // *** תיקון (בקשה מפורשת - "וכמובן שמירה קבועה"): מ-sessionStorage (נמחק כשסוגרים את הטאב) ל-
  // localStorage (שורד סגירת דפדפן/טאב) - כדי שהוספת פריטים לאוסף לא תלך לאיבוד אם יוצאים מהעמוד
  // לפני "פרסום האוסף" בפועל.
  useEffect(() => {
    if (mode !== "create") return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as CollectionFormInitial & { type: CollectionType };
      if (draft.type !== type) return;
      setTitle(draft.title);
      setDescription(draft.description);
      setCoverUrl(draft.coverUrl);
      setVisibility(draft.visibility);
      setItems(draft.items);
    } catch {
      // טיוטה פגומה - מתעלמים
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, type]);

  // *** תוספת (אותה בקשה - "שמירה קבועה"): שמירה שוטפת של הטיוטה בכל שינוי, לא רק ברגע היציאה
  // הזמנית ל"הוספת מקום" (handleGoAddPlace למטה) - כך שכל פריט שנוסף לאוסף נשמר מיד, גם אם המשתמש
  // סוגר את האפליקציה/הדפדפן ולא לוחץ בפועל על "פרסום האוסף".
  useEffect(() => {
    if (mode !== "create") return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ type, title, description, coverUrl, visibility, items }));
    } catch {
      // localStorage חסום - ממשיכים בלי טיוטה
    }
  }, [mode, type, title, description, coverUrl, visibility, items]);

  function handleGoAddPlace() {
    router.push("/places/create");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.key === active.id);
      const to = prev.findIndex((i) => i.key === over.id);
      return from < 0 || to < 0 ? prev : arrayMove(prev, from, to);
    });
  }

  function handleAddItem(item: CollectionFormItem) {
    setItems((prev) => {
      if (prev.some((i) => i.key === item.key) || prev.length >= COLLECTION_LIMITS.maxItems) return prev;
      return [...prev, item];
    });
  }

  const canPublish = title.trim().length > 0 && items.length >= COLLECTION_LIMITS.minItems && !submitting;
  const itemImages = items.map((i) => i.imageUrl).filter((u): u is string => !!u);

  async function handleSubmit() {
    if (!canPublish) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = { title: title.trim(), description: description.trim() || null, coverUrl, visibility, items: toItemInputs(items) };
      const res =
        mode === "create"
          ? await fetch("/api/social/collections", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type, ...body }),
            })
          : await fetch(`/api/social/collections/${collectionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "שגיאה בשמירת החוויה");
      // *** תיקון (אותה בקשה - "שמירה קבועה"): פורסם בהצלחה - מוחקים את הטיוטה הקבועה, כדי שאוסף
      // הבא (create) לא "יירש" בטעות את הפריטים של האוסף הזה.
      if (mode === "create") {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          // localStorage חסום - לא קריטי
        }
      }
      router.replace(`/places/collection/${mode === "create" ? data.id : collectionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירת החוויה");
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!collectionId || !window.confirm("למחוק את החוויה? הפעולה לא הפיכה.")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/social/collections/${collectionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("שגיאה במחיקת החוויה");
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה במחיקת החוויה");
      setSubmitting(false);
    }
  }

  const missing = COLLECTION_LIMITS.minItems - items.length;

  return (
    <div className="px-5 pb-12 pt-6">
      <h1 className="mb-5 text-[22px] font-extrabold leading-tight text-ink">
        {mode === "create" ? "יצירת חוויה" : "עריכת חוויה"}
        <span className="ms-2 text-[15px] font-bold text-ink-secondary">{type === "places" ? "📍 מקומות" : "✈️ טיולים"}</span>
      </h1>

      <label className="mb-1 block text-[13px] font-semibold text-ink-secondary">כותרת החוויה</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={COLLECTION_LIMITS.maxTitle}
        placeholder="איך תקראו לחוויה?"
        className="w-full rounded-card border border-ink-secondary/20 px-4 py-3 text-[16px] focus:outline-none"
        style={{ borderColor: title ? "var(--color-places-purple)" : undefined }}
      />
      <p className="mb-4 mt-1 text-[12px] text-ink-secondary">למשל: {TITLE_EXAMPLES[type].map((e) => `"${e}"`).join(" · ")}</p>

      <label className="mb-1 block text-[13px] font-semibold text-ink-secondary">תיאור (אופציונלי)</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={COLLECTION_LIMITS.maxDescription}
        rows={3}
        placeholder="ספרו בקצרה על החוויה..."
        className="mb-5 w-full resize-none rounded-card border border-ink-secondary/20 px-4 py-3 text-[15px] focus:outline-none"
      />

      <label className="mb-2 block text-[13px] font-semibold text-ink-secondary">תמונת החוויה</label>
      <div className="mb-5 overflow-hidden rounded-2xl shadow-soft">
        <div className="relative">
          <CollectionCover coverUrl={coverUrl} collageUrls={itemImages} type={type} className="aspect-[16/9]" />
          <button
            type="button"
            onClick={() => setCoverSheetOpen(true)}
            className="absolute bottom-2 end-2 rounded-pill bg-black/55 px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            החלפת תמונת החוויה
          </button>
        </div>
        <p className="bg-white px-3 py-2 text-[12px] text-ink-secondary">
          {coverUrl ? "תמונת החוויה שבחרתם" : "תמונת חוויה אוטומטית - נוצרת מהתמונות של הפריטים הראשונים"}
        </p>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <label className="text-[13px] font-semibold text-ink-secondary">
          {type === "places" ? "מקומות" : "טיולים"} ({items.length})
        </label>
      </div>

      {items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
            <ul className="mb-3 flex flex-col gap-2">
              {items.map((item) => (
                <SortableItemRow
                  key={item.key}
                  item={item}
                  onRemove={(key) => setItems((prev) => prev.filter((i) => i.key !== key))}
                  onNoteChange={(key, note) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, note } : i)))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        disabled={items.length >= COLLECTION_LIMITS.maxItems}
        className="h-12 rounded-xl text-[15.5px] font-semibold w-full border-2 border-dashed disabled:opacity-50"
        style={{ borderColor: "var(--color-places-purple)", color: "var(--color-places-purple)" }}
      >
        + {labels.addLabel}
      </button>
      {missing > 0 && (
        <p className="mt-2 text-center text-[12px] text-ink-secondary">
          כדי לפרסם צריך לפחות {COLLECTION_LIMITS.minItems} {type === "places" ? "מקומות" : "טיולים"}
        </p>
      )}

      <label className="mb-2 mt-6 block text-[13px] font-semibold text-ink-secondary">מי יכול לראות?</label>
      <div className="mb-6">
        <VisibilityChips value={visibility} onChange={setVisibility} />
      </div>

      {error && <p className="mb-3 text-[12.5px] text-red-500">{error}</p>}

      <button
        type="button"
        disabled={!canPublish}
        onClick={handleSubmit}
        className="h-12 rounded-xl text-[15.5px] font-semibold w-full text-white disabled:opacity-50"
        style={{ background: PURPLE_GRADIENT }}
      >
        {submitting ? "שומרים..." : mode === "create" ? "פרסום החוויה" : "שמירת שינויים"}
      </button>

      {mode === "edit" && (
        <button type="button" onClick={handleDelete} disabled={submitting} className="mt-3 w-full py-2.5 text-[13.5px] font-bold text-red-500 disabled:opacity-50">
          מחיקת החוויה
        </button>
      )}

      {pickerOpen && (
        <CollectionItemPickerSheet
          type={type}
          addedKeys={new Set(items.map((i) => i.key))}
          onAdd={handleAddItem}
          onClose={() => setPickerOpen(false)}
          onGoAddPlace={type === "places" ? handleGoAddPlace : undefined}
          // *** תיקון (בקשה מפורשת - "עכשיו רק באוסף - במקומות ובטיולים - צריך להחזיר את 'מה תרצו
          // להוסיף' לצבע לבן"): "מה תרצו להוסיף?" נשאר תמיד לבן בזרימת האוסף - גם ב-type="places"
          // וגם ב-type="trips" - בלי קשר ל-dark שהתקבל מ-collection/create/page.tsx (origin=content).
          // ה-dark ההוא עדיין משפיע על CollectionTypeSheet הקודם ("מה תרצו לאסוף?") - לא נגעתי בו.
        />
      )}

      {coverSheetOpen && (
        <CoverPickerSheet
          coverUrl={coverUrl}
          imageUrls={itemImages}
          heading="בחירת תמונת החוויה"
          autoLabel="תמונת חוויה אוטומטית"
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
