"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageOptionRow } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { uploadMultipleSocialMedia, type UploadedMedia } from "@/services/social/mediaUploadService";
import type { PlaceSubmissionCategory } from "@/services/social/placeSubmissionService";

interface AddPlaceModalProps {
  onClose: () => void;
}

const CATEGORIES: { id: PlaceSubmissionCategory; label: string; imageSrc: string }[] = [
  { id: "attraction", label: "אטרקציות וחוויות", imageSrc: "/images/categories/cat-attraction.png" },
  { id: "restaurant", label: "מסעדות וקולינריה", imageSrc: "/images/categories/cat-food.png" },
  { id: "shopping", label: "קניות ושופינג", imageSrc: "/images/categories/cat-shopping.png" },
  { id: "nature", label: "טבע ונופים", imageSrc: "/images/categories/cat-nature.png" },
  { id: "nightlife", label: "חיי לילה ובילויים", imageSrc: "/images/categories/cat-nightlife.png" },
  { id: "hotel", label: "לינה", imageSrc: "/images/categories/cat-sleep.png" },
];

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

interface DuplicateMatch {
  id: string;
  name: string;
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
 * *** Modal (לא Bottom Sheet, לא section) להוספת מקום - סעיפים 5-8
 * בפרומפט. נפתח מעל המפה עם overlay עדין, שומר על אותה תשתית קיימת
 * בדיוק (autocomplete של Google via /api/places/search-autocomplete,
 * בדיקת כפילות via /api/social/place-submissions/check-duplicate,
 * העלאת מדיה via mediaUploadService, שמירה via /api/social/
 * place-submissions) כמו SuggestPlaceSheet.tsx הקיים ב-place's - רק
 * במארז Modal (לא BottomSheet) ועם השדות הנוספים שהתבקשו: תמונה
 * ראשונה בסדר, המשך ידני כשגוגל לא מוצא, ודירוג 1-5.
 *
 * ה-AI/Google לא רצים כאן בכלל - הם רצים בצד השרת *אחרי* השמירה
 * (ר' placeSubmissionEnrichmentService.ts), בדיוק כמו שנדרש.
 */
export function AddPlaceModal({ onClose }: AddPlaceModalProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [media, setMedia] = useState<(UploadedMedia & { previewUrl: string })[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [nameQuery, setNameQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GoogleDetails | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [duplicateOf, setDuplicateOf] = useState<DuplicateMatch | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [noResultsYet, setNoResultsYet] = useState(false);

  const [category, setCategory] = useState<PlaceSubmissionCategory | null>(null);
  const [rating, setRating] = useState(0);
  const [description, setDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleNameChange(value: string) {
    setNameQuery(value);
    setSelected(null);
    setDuplicateOf(null);
    setManualEntry(false);
    setNoResultsYet(false);
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
        setSuggestions(data.suggestions ?? []);
        setNoResultsYet((data.suggestions ?? []).length === 0);
      } catch {
        setSuggestions([]);
        setNoResultsYet(true);
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  async function handleSelectSuggestion(suggestion: AutocompleteSuggestion) {
    setSuggestions(null);
    setNameQuery(suggestion.mainText);
    setCheckingDuplicate(true);
    setError(null);
    try {
      const detailsRes = await fetch(`/api/places/search-result-details?placeId=${encodeURIComponent(suggestion.placeId)}`).then((r) =>
        r.json()
      );

      const dupParams = new URLSearchParams({ placeId: suggestion.placeId });
      if (detailsRes.name) dupParams.set("name", detailsRes.name);
      if (detailsRes.latitude != null) dupParams.set("lat", String(detailsRes.latitude));
      if (detailsRes.longitude != null) dupParams.set("lng", String(detailsRes.longitude));
      const dupRes = await fetch(`/api/social/place-submissions/check-duplicate?${dupParams}`).then((r) => r.json());

      if (dupRes.exists) {
        setDuplicateOf(dupRes.place);
        setSelected(null);
        return;
      }

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
    } finally {
      setCheckingDuplicate(false);
    }
  }

  /** *** סעיף 6 בפרומפט - "אם המקום לא נמצא, יש לאפשר המשך בהוספה
   *  ידנית, אך לסמן את המקום ככזה שדורש אישור מערכת" - אין
   *  google_place_id כאן בכלל, אז השורה נכנסת כ-pending כמו כל הצעה
   *  (ר' place_submissions - זה כבר ההתנהגות הקיימת של הטבלה, לא
   *  נדרש דגל נוסף). */
  function continueManually() {
    setManualEntry(true);
    setSuggestions(null);
    setDuplicateOf(null);
    setSelected({
      placeId: "",
      name: nameQuery.trim(),
      address: "",
      latitude: NaN,
      longitude: NaN,
    });
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
    if (submitting) return; // מניעת שליחה כפולה (סעיף 6)
    if (!selected || !selected.name.trim()) {
      setError(duplicateOf ? "המקום הזה כבר קיים - אי אפשר להוסיף אותו שוב" : "בחר מקום מתוך ההשלמה האוטומטית או המשך ידנית");
      return;
    }
    if (!category) {
      setError("בחר סוג מקום");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const isManual = !selected.placeId;
      const res = await fetch("/api/social/place-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selected.name.trim(),
          category,
          rating: rating > 0 ? rating : undefined,
          address: isManual ? undefined : selected.address,
          latitude: isManual || Number.isNaN(selected.latitude) ? undefined : selected.latitude,
          longitude: isManual || Number.isNaN(selected.longitude) ? undefined : selected.longitude,
          description: description.trim() || undefined,
          googlePlaceId: isManual ? undefined : selected.placeId,
          googlePhotoUrl: selected.photoUrl ?? undefined,
          mediaIds: media.map((m) => m.id),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "שגיאה בשמירת המקום");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden bg-white shadow-soft"
        style={{ borderRadius: 22 }}
      >
        <div className="flex items-center justify-between border-b border-ink-secondary/10 px-4 py-3">
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
          /* only content scrolls internally - not the Home page behind (סעיף 5) */
          <div className="overflow-y-auto overscroll-contain px-4 py-4">
            {/* 1. תמונה - ראשונה בסדר, עם preview אמיתי (לא רק שם קובץ) */}
            <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-secondary">תמונה</label>
            {media.length > 0 ? (
              <div className="mb-2 grid grid-cols-4 gap-2">
                {media.map((m) => (
                  <div key={m.id} className="relative aspect-square overflow-hidden rounded-[12px] bg-bg-secondary">
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
            ) : null}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            {media.length < 4 && (
              <button
                type="button"
                disabled={uploadingMedia}
                onClick={() => galleryInputRef.current?.click()}
                className="flex h-24 w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-ink-secondary/30 text-[13px] font-medium text-ink-secondary disabled:opacity-50"
              >
                {uploadingMedia ? "מעלה..." : "＋ הוספת תמונה"}
              </button>
            )}

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

            {checkingDuplicate && <p className="mt-2 text-[12px] text-ink-secondary">בודק אם המקום כבר קיים...</p>}

            {duplicateOf && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-card bg-bg-secondary px-3 py-2.5">
                <span className="min-w-0 flex-1 text-[12.5px] text-ink-secondary">
                  <b className="text-ink">{duplicateOf.name}</b> כבר קיים אצלנו
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/place/${duplicateOf.id}`);
                  }}
                  className="shrink-0 rounded-pill border border-ink-secondary/20 px-3 py-1.5 text-[12px] font-semibold text-ink"
                >
                  פתח
                </button>
              </div>
            )}

            {/* אין תוצאות מגוגל - אפשרות המשך ידני (סעיף 6) */}
            {!selected && !duplicateOf && noResultsYet && nameQuery.trim().length >= 3 && (
              <button
                type="button"
                onClick={continueManually}
                className="mt-2 w-full rounded-card border border-dashed border-ink-secondary/30 py-2.5 text-[12.5px] font-semibold text-ink-secondary"
              >
                לא מצאנו את המקום ב-Google - המשך בהוספה ידנית
              </button>
            )}

            {selected && selected.name && (
              <div className="mt-2 flex items-center gap-2 rounded-card bg-bg-secondary px-3 py-2.5">
                <span style={{ color: "var(--color-primary-start)" }}>📍</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{selected.name}</span>
                  {selected.address && <span className="block truncate text-[11.5px] text-ink-secondary">{selected.address}</span>}
                  {manualEntry && <span className="block text-[11px] text-ink-secondary">הוספה ידנית - ידרוש אישור מערכת</span>}
                </span>
              </div>
            )}

            {/* 3. סוג - קטגוריה ראשית אחת מתוך 6 */}
            <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold text-ink-secondary">סוג</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <ImageOptionRow
                  key={c.id}
                  selected={category === c.id}
                  onClick={() => setCategory(c.id)}
                  label={c.label}
                  imageSrc={c.imageSrc}
                  textSize={12.5}
                />
              ))}
            </div>

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

            {/* 6. שמירה */}
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="mt-5 w-full rounded-pill py-3 text-[14px] font-bold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              {submitting ? "שומר..." : "שמור מקום"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
