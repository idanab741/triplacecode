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
import { COLLECTION_DRAFT_KEY } from "./createDrafts";
import { Button } from "@/components/ui";
import {
  ActionRow,
  CloseIcon,
  CreatePageHeader,
  ErrorBox,
  FIELD_CLASS,
  FieldLabel,
  GripIcon,
  ImageIcon,
  OptionalTag,
  PinIcon,
  PlaneIcon,
  PlusIcon,
  TEXTAREA_CLASS,
} from "@/screens/create/CreateUi";
const DRAFT_KEY = COLLECTION_DRAFT_KEY;

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
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#EFF1F4] text-[#9aa1ad]">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : item.kind === "trip" ? (
            <PlaneIcon />
          ) : (
            <PinIcon />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{item.title}</span>
          {item.subtitle && <span className="block truncate text-[12.5px] text-ink-secondary">{item.subtitle}</span>}
        </span>
        <button
          type="button"
          onClick={() => onRemove(item.key)}
          aria-label="הסרה"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-ink-secondary shadow-[0_1px_3px_rgba(15,20,25,0.12)] active:scale-90"
        >
          <CloseIcon />
        </button>
      </div>
      <input
        value={item.note}
        onChange={(e) => onNoteChange(item.key, e.target.value)}
        maxLength={COLLECTION_LIMITS.maxNote}
        placeholder="הערה קצרה (לא חובה)"
        className="mt-2 h-10 w-full rounded-full bg-white px-4 text-[14px] text-ink placeholder:text-[#9aa1ad] focus:outline-none focus:ring-2 focus:ring-[#0A6DFE]/30"
      />
    </li>
  );
}

function readDraft(type: CollectionType): CollectionFormInitial | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as CollectionFormInitial & { type: CollectionType };
    return draft.type === type ? draft : null;
  } catch {
    return null; // טיוטה פגומה / localStorage חסום - מתעלמים
  }
}

/** טופס יצירה/עריכה של אוסף (משותף). כותרת (חובה) · תיאור · Cover · פריטים (לפחות 2, גרירה לסדר) · פרטיות. */
export function CollectionForm({ mode, type, collectionId, initial, dark = false }: CollectionFormProps) {
  const router = useRouter();
  const labels = COLLECTION_TYPE_LABELS[type];

  // *** תיקון: הטיוטה נטענת כערך ההתחלתי של הטופס (ולא ב-effect). קודם effect השחזור ו-effect השמירה
  // רצו באותו רגע - השמירה כתבה את הטופס הריק מעל הטיוטה לפני שהשחזור נקלט, והפריטים (למשל מבחירה
  // מרובה במפה / ב"הבחירות שלי") הלכו לאיבוד.
  const [draft] = useState<CollectionFormInitial | null>(() => (mode === "create" ? readDraft(type) : null));
  const start = initial ?? draft;
  const [title, setTitle] = useState(start?.title ?? "");
  const [description, setDescription] = useState(start?.description ?? "");
  const [coverUrl, setCoverUrl] = useState<string | null>(start?.coverUrl ?? null);
  const [visibility, setVisibility] = useState<CollectionVisibility>(start?.visibility ?? "public");
  const [items, setItems] = useState<CollectionFormItem[]>(start?.items ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [coverSheetOpen, setCoverSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // *** תיקון (בקשה מפורשת - "וכמובן שמירה קבועה"): הטיוטה נשמרת ב-localStorage (שורד סגירת דפדפן/טאב) -
  // כדי שהוספת פריטים לאוסף לא תלך לאיבוד אם יוצאים מהעמוד לפני "פרסום האוסף" בפועל. נטענת למעלה
  // (readDraft) כערך ההתחלתי.

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
  const itemsWord = type === "places" ? "מקומות" : "טיולים";

  return (
    <div className="mx-auto max-w-xl px-5 pb-12 pt-4">
      {/* *** עיצוב מחדש (בקשה מפורשת - "נתאים לעיצוב של האפליקציה"): אותה שפה כמו יצירת פוסט/מקום -
          כותרת גדולה + שורת הסבר, שדות אפורים-בהירים בלי מסגרות, כחול לבחירה, והכפתור הראשי הקבוע. */}
      <CreatePageHeader
        title={mode === "create" ? "יצירת חוויה" : "עריכת חוויה"}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <span className="text-ink">{type === "places" ? <PinIcon size={15} /> : <PlaneIcon size={15} />}</span>
            {type === "places" ? "חוויה של מקומות - אספו מקומות סביב רעיון אחד" : "חוויה של טיולים - אספו טיולים שאהבתם"}
          </span>
        }
      />

      <FieldLabel htmlFor="collection-title">איך תקראו לחוויה?</FieldLabel>
      <input
        id="collection-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={COLLECTION_LIMITS.maxTitle}
        placeholder="כותרת החוויה"
        className={`${FIELD_CLASS} text-[16px]`}
      />
      {/* רעיונות לכותרת - לחיצה ממלאת את השדה. נעלמים ברגע שמתחילים לכתוב. */}
      {!title && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {TITLE_EXAMPLES[type].map((example) => (
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
        <FieldLabel htmlFor="collection-description">
          תיאור <OptionalTag />
        </FieldLabel>
        <textarea
          id="collection-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={COLLECTION_LIMITS.maxDescription}
          rows={3}
          placeholder="ספרו בקצרה על החוויה..."
          className={TEXTAREA_CLASS}
        />
      </div>

      <div className="mt-6">
        <FieldLabel>תמונת החוויה</FieldLabel>
        <div className="relative overflow-hidden rounded-[20px]">
          <CollectionCover coverUrl={coverUrl} collageUrls={itemImages} type={type} className="aspect-[16/9]" />
          <button
            type="button"
            onClick={() => setCoverSheetOpen(true)}
            className="absolute bottom-2.5 end-2.5 flex h-9 items-center gap-1.5 rounded-full bg-black/55 px-3.5 text-[13px] font-semibold text-white backdrop-blur-sm active:scale-95"
          >
            <ImageIcon size={16} />
            החלפה
          </button>
        </div>
        <p className="mt-1.5 text-[12.5px] text-ink-secondary">
          {coverUrl ? "התמונה שבחרתם" : `נוצרת אוטומטית מהתמונות של ה${itemsWord} הראשונים`}
        </p>
      </div>

      <div className="mt-6">
        <div className="mb-1.5 flex items-baseline justify-between">
          <FieldLabel>{itemsWord}</FieldLabel>
          {items.length > 0 && <span className="text-[13px] font-medium tabular-nums text-ink-secondary">{items.length}</span>}
        </div>

        {items.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
              <ul className="mb-2 flex flex-col gap-2">
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

        <ActionRow
          icon={<PlusIcon />}
          title={labels.addLabel}
          subtitle={
            missing > 0
              ? `כדי לפרסם צריך לפחות ${COLLECTION_LIMITS.minItems} ${itemsWord}${items.length > 0 ? ` - עוד ${missing}` : ""}`
              : items.length > 1
                ? "אפשר לגרור כדי לשנות סדר"
                : undefined
          }
          disabled={items.length >= COLLECTION_LIMITS.maxItems}
          onClick={() => setPickerOpen(true)}
        />
      </div>

      <div className="mt-6">
        <FieldLabel>מי יכול לראות?</FieldLabel>
        <VisibilityChips value={visibility} onChange={setVisibility} />
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      <Button type="button" fullWidth disabled={!canPublish} onClick={handleSubmit} className="mt-8">
        {submitting ? "שומרים..." : mode === "create" ? "פרסום החוויה" : "שמירת שינויים"}
      </Button>

      {mode === "edit" && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={submitting}
          className="mt-2 h-11 w-full text-[14px] font-semibold text-[#C8373C] disabled:opacity-50"
        >
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
