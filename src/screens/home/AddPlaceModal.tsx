"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOptionRow } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { uploadMultipleSocialMedia, type UploadedMedia } from "@/services/social/mediaUploadService";
import { HOME_QUICK_CATEGORIES } from "@/constants/homeQuickCategories";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";
import type { TripAddCategory } from "@/services/tripadd/tripAddService";

interface AddPlaceModalProps {
  onClose: () => void;
  /** נקרא אחרי שמירה מוצלחת - כדי ש-page.tsx יטען מחדש את הפינים
   *  מ-tripadd (בקשה מפורשת - "תעשה שיופיע ישר על המפה"): הפין החדש
   *  אמור להופיע מיד, בלי צורך ברענון ידני של הדף. */
  onSaved?: () => void;
}

interface AutocompleteSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface GoogleDetails {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  photoUrl?: string | null;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} כוכבים`}
          className="flex h-9 w-9 items-center justify-center active:scale-90"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill={n <= value ? "#F5A623" : "none"}
            stroke={n <= value ? "#F5A623" : "var(--color-ink-secondary)"}
            strokeWidth="1.5"
            strokeLinejoin="round"
          >
            <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.7z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/**
 * *** TripAdd - Modal (לא Bottom Sheet) להוספת מקום, מעל המפה בעמוד
 * הבית. *** מאגר עצמאי ונפרד לגמרי (בקשה מפורשת - "המאגר הזה מנותק
 * מהמאגר שהיה!"): שומר ל-/api/tripadd/submissions (טבלה עצמאית
 * tripadd_submissions) - **אין כאן שום בדיקת כפילות** מול
 * places/destinations/place_submissions הישנים. autocomplete של
 * Google עדיין דרך אותו endpoint קיים (search-autocomplete) - זה
 * שירות חיצוני משותף, לא "מאגר" - אין בעיה לחלוק אותו.
 */
export function AddPlaceModal({ onClose, onSaved }: AddPlaceModalProps) {
  const { user } = useAuth();

  // *** תיקון (בקשה מפורשת - "הכפתור עדיין נבלע!"): במקום להסתמך על
  // vh/dvh ב-CSS (שכבר גילינו קודם בשיחה הזו שלא תמיד אמין בתוך
  // WebView של Natively), מודדים את גובה ה-viewport בפועל ב-JS
  // (window.innerHeight) ומגבילים את ה-Modal לפי זה במפורש - עמיד
  // בפני כל הבעיות של יחידות CSS-viewport ב-WebView.
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  useEffect(() => {
    function update() {
      setViewportHeight(window.innerHeight);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const [media, setMedia] = useState<(UploadedMedia & { previewUrl: string })[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [nameQuery, setNameQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GoogleDetails | null>(null);
  const [noResultsYet, setNoResultsYet] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const [category, setCategory] = useState<TripAddCategory | null>(null);
  // *** תיקון (בקשה מפורשת - "ברגע שלוחצים קטגוריה - ה-AI אמור להשלים
  // באופן אוטומטי גם את הקטגוריה משנה וגם את תת הקטגוריה"): subcategory
  // כבר לא נבחר ידנית מצ'יפים - הוא מסווג אוטומטית ע"י AI מיד עם בחירת
  // הקטגוריה, לפי שם/כתובת המקום שכבר נבחר מ-Google (ר' handleSelectCategory).
  // subcategoryGroup הוא רק לתצוגה (הקבוצה מתוך tripAddSubcategories.ts) -
  // לא נשמר בטופס, רק ה-tag הסופי נשמר בשדה subcategory הקיים.
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [subcategoryGroup, setSubcategoryGroup] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [description, setDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleNameChange(value: string) {
    setNameQuery(value);
    setSelected(null);
    setNoResultsYet(false);
    setGoogleError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places/search-autocomplete?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        if (data.error) {
          setGoogleError(`שגיאה בחיפוש ב-Google: ${data.error}`);
          setSuggestions([]);
          setNoResultsYet(false);
          return;
        }
        setSuggestions(data.suggestions ?? []);
        setNoResultsYet((data.suggestions ?? []).length === 0);
      } catch {
        setGoogleError("שגיאת רשת בחיפוש ב-Google");
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  async function handleSelectSuggestion(suggestion: AutocompleteSuggestion) {
    setSuggestions(null);
    setNameQuery(suggestion.mainText);
    setError(null);
    try {
      const detailsRes = await fetch(`/api/places/search-result-details?placeId=${encodeURIComponent(suggestion.placeId)}`).then((r) =>
        r.json()
      );
      setSelected({
        placeId: suggestion.placeId,
        name: detailsRes.name ?? suggestion.mainText,
        address: detailsRes.address ?? suggestion.secondaryText,
        latitude: detailsRes.latitude,
        longitude: detailsRes.longitude,
        photoUrl: detailsRes.imageUrl ?? null,
      });
    } catch {
      setError("שגיאה בטעינת פרטי המקום מגוגל");
    }
  }

  /**
   * *** בקשה מפורשת - "אם המשתמש לא בחר מקום מגוגל - אז אי אפשר יהיה
   * לשמור את האטרקציה!": בניגוד לגרסה הקודמת, אין יותר אפשרות "המשך
   * בהוספה ידנית" - חובה להתאים למקום אמיתי מ-Google (יש placeId),
   * כי הסיווג האוטומטי של תת-הקטגוריה (AI) ושמירת המקום תלויים בזה.
   *
   * ברגע שנבחרה קטגוריה (אחרי שכבר יש selected.placeId), קוראים
   * ל-AI שמסווג אוטומטית קבוצה+תגית מתוך הרשימה הסגורה של
   * tripAddSubcategories.ts - בלי מעורבות ידנית של המשתמש.
   */
  async function handleSelectCategory(c: TripAddCategory) {
    setCategory(c);
    setSubcategory(null);
    setSubcategoryGroup(null);
    setClassifyError(null);
    if (!selected?.placeId) return;

    setClassifying(true);
    try {
      const res = await fetch("/api/tripadd/classify-subcategory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selected.name, address: selected.address, category: c }),
      });
      const data = await res.json();
      if (!res.ok || !data.tag) {
        setClassifyError(data.error || "לא הצלחנו לזהות תת-קטגוריה אוטומטית");
        return;
      }
      setSubcategoryGroup(data.group ?? null);
      setSubcategory(data.tag);
    } catch {
      setClassifyError("שגיאת רשת בזיהוי תת-הקטגוריה");
    } finally {
      setClassifying(false);
    }
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || !user) return;
    const selectedFiles = Array.from(files).slice(0, 4 - media.length);
    if (selectedFiles.length === 0) return;
    setUploadingMedia(true);
    try {
      const supabase = createClient();
      const uploaded = await uploadMultipleSocialMedia(supabase, user.id, selectedFiles);
      setMedia((prev) => [...prev, ...uploaded.map((m, i) => ({ ...m, previewUrl: URL.createObjectURL(selectedFiles[i]) }))]);
    } catch {
      setError("שגיאה בהעלאת התמונה");
    } finally {
      setUploadingMedia(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  async function handleSubmit() {
    if (submitting) return;
    if (!selected?.placeId) {
      setError("יש לבחור מקום מתוך תוצאות החיפוש של Google");
      return;
    }
    const finalName = selected.name.trim();
    if (!finalName) {
      setError("הזן שם מקום, או בחר הצעה מהחיפוש");
      return;
    }
    if (!category) {
      setError("בחר סוג מקום");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/tripadd/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalName,
          category,
          rating: rating > 0 ? rating : undefined,
          address: selected.address,
          latitude: Number.isNaN(selected.latitude) ? undefined : selected.latitude,
          longitude: Number.isNaN(selected.longitude) ? undefined : selected.longitude,
          description: description.trim() || undefined,
          subcategory: subcategory ?? undefined,
          googlePlaceId: selected.placeId,
          googlePhotoUrl: selected.photoUrl ?? undefined,
          mediaIds: media.map((m) => m.id),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "שגיאה בשמירת המקום");
      }
      setDone(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 24px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex w-full max-w-sm flex-col overflow-hidden bg-white shadow-soft"
        style={{ borderRadius: 22, maxHeight: viewportHeight ? viewportHeight - 48 : "80vh" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ink-secondary/10 px-4 py-3">
          <h2 className="text-[16px] font-bold text-ink">הוספת מקום</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-secondary text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="text-3xl">✅</span>
            <h3 className="text-[15px] font-bold text-ink">המקום נשמר!</h3>
            <p className="max-w-xs text-[13px] text-ink-secondary">
              הפרטים שלך נשמרו וממתינים לבדיקת המערכת. ברגע שהמקום יאושר, הוא ייכנס למאגר ויופיע במפה ובעמוד שלו.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-pill px-6 py-2.5 text-[13px] font-bold text-white"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              סגור
            </button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {/* 1. תמונה - *** תיקון (בקשה מפורשת - "השורה צריכה להיות
                  ריבוע, לא מלבן, וכשלוחצים היא פותחת ריבוע לידו באותו
                  גודל - לא מעליו"): שורה אחת אופקית, כל הריבועים
                  (כפתור ההוספה + כל preview) באותו גודל בדיוק (h-20
                  w-20), אחד ליד השני - לא כפתור-מלבן-רחב עם grid
                  נפרד מעליו. */}
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-secondary">תמונה</label>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {media.length < 4 && (
                  <button
                    type="button"
                    disabled={uploadingMedia}
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-ink-secondary/30 text-[11px] font-medium text-ink-secondary disabled:opacity-50"
                  >
                    <span className="text-lg leading-none">＋</span>
                    {uploadingMedia ? "מעלה..." : "הוספת תמונה"}
                  </button>
                )}
                {media.map((m) => (
                  <div key={m.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] bg-bg-secondary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.previewUrl} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setMedia((prev) => prev.filter((x) => x.id !== m.id))}
                      aria-label="הסר"
                      className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* 2. שם המקום + autocomplete */}
              <label className="mb-1 mt-4 block text-[12.5px] font-semibold text-ink-secondary">שם המקום</label>
              <div className="relative">
                <input
                  value={nameQuery}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="לדוגמה: קפה השעון"
                  className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                {(searching || (suggestions && suggestions.length > 0)) && (
                  <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-card bg-white shadow-soft ring-1 ring-black/5">
                    {searching && <p className="p-3 text-center text-[12.5px] text-ink-secondary">מחפש...</p>}
                    {!searching &&
                      suggestions?.map((s) => (
                        <button
                          key={s.placeId}
                          type="button"
                          onClick={() => handleSelectSuggestion(s)}
                          className="block w-full px-3 py-2.5 text-start hover:bg-bg-secondary"
                        >
                          <span className="block text-[13.5px] font-semibold text-ink">{s.mainText}</span>
                          <span className="block text-[11.5px] text-ink-secondary">{s.secondaryText}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {googleError && <p className="mt-2 text-[12px] text-red-500">{googleError}</p>}

              {!selected && !googleError && noResultsYet && nameQuery.trim().length >= 3 && (
                <p className="mt-2 text-[12.5px] text-ink-secondary">
                  לא מצאנו את המקום הזה ב-Google - נסה/י לחפש בשם מעט שונה (לדוגמה בלי ניקוד, או עם שם העיר).
                </p>
              )}

              {selected && selected.name && (
                <div className="mt-2 flex items-center gap-2 rounded-card bg-bg-secondary px-3 py-2.5">
                  <span style={{ color: "var(--color-primary-start)" }}>📍</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{selected.name}</span>
                    {selected.address && <span className="block truncate text-[11.5px] text-ink-secondary">{selected.address}</span>}
                  </span>
                </div>
              )}

              {/* 3. סוג - אותן 6 קטגוריות בדיוק כמו שורת "סוגי הטיול" בבית.
                  *** בקשה מפורשת - "אם המשתמש לא בחר מקום מגוגל - אז אי
                  אפשר יהיה לשמור את האטרקציה" - הבחירה נעולה עד שיש
                  התאמת Google אמיתית (selected.placeId). */}
              <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold text-ink-secondary">סוג</label>
              <div className={`flex flex-wrap gap-2 ${!selected?.placeId ? "pointer-events-none opacity-40" : ""}`}>
                {HOME_QUICK_CATEGORIES.map((c) => (
                  <ImageOptionRow
                    key={c.id}
                    selected={category === c.id}
                    onClick={() => handleSelectCategory(c.id)}
                    label={HOME_QUICK_CATEGORY_LABELS[c.id]}
                    imageSrc={c.imageSrc}
                    textSize={12.5}
                  />
                ))}
              </div>

              {/* *** תיקון (בקשה מפורשת - "ברגע שלוחצים קטגוריה - ה-AI
                  אמור להשלים באופן אוטומטי גם את הקטגוריה משנה וגם
                  את תת הקטגוריה"): אין יותר צ'יפים לבחירה ידנית - ה-AI
                  מסווג אוטומטית מתוך הרשימה הסגורה (tripAddSubcategories.ts)
                  מיד עם בחירת הקטגוריה, ומוצג כאן כתוצאה בלבד. */}
              {category && (
                <div className="mt-3">
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-secondary">תת-קטגוריה</label>
                  {classifying && <p className="text-[12.5px] text-ink-secondary">מזהה תת-קטגוריה אוטומטית...</p>}
                  {!classifying && subcategory && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                      {subcategoryGroup && <span className="text-ink-secondary">{subcategoryGroup} ·</span>}
                      <span
                        className="rounded-pill px-3 py-1.5 font-semibold text-white"
                        style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
                      >
                        {subcategory}
                      </span>
                    </div>
                  )}
                  {!classifying && classifyError && <p className="text-[12px] text-red-500">{classifyError}</p>}
                </div>
              )}

              {/* 4. דירוג */}
              <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold text-ink-secondary">דירוג</label>
              <StarRating value={rating} onChange={setRating} />

              {/* 5. תיאור / חוויה אישית */}
              <label className="mb-1 mt-4 block text-[12.5px] font-semibold text-ink-secondary">תיאור / חוויה אישית</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="ספר/י מה חווית במקום הזה..."
                className="w-full resize-none rounded-[14px] border border-ink-secondary/20 p-3 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-accent/40"
              />

              {error && <p className="mt-3 text-[12.5px] text-red-500">{error}</p>}
            </div>

            {/* 6. שמירה - פוטר קבוע, כולל safe-area, תמיד גלוי */}
            <div
              className="shrink-0 border-t border-ink-secondary/10 px-4 pt-3"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
            >
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="w-full rounded-pill py-3 text-[14px] font-bold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
              >
                {submitting ? "שומר..." : "שמור מקום"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
