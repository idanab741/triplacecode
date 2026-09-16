"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BottomSheet, Input, ImageOptionRow, BackButton } from "@/components/ui";
import { CreateReviewSheet } from "@/screens/places/CreateReviewSheet";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { uploadMultipleSocialMedia, type UploadedMedia } from "@/services/social/mediaUploadService";
import type { PlaceSubmissionCategory } from "@/services/social/placeSubmissionService";

const PLACES_PURPLE_GRADIENT = "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))";

const CATEGORIES: { id: PlaceSubmissionCategory; label: string; imageSrc?: string; icon?: ReactNode }[] = [
  { id: "restaurant", label: "מסעדה", imageSrc: "/images/tripmatch/category-restaurants.png" },
  { id: "attraction", label: "אטרקציה", imageSrc: "/images/tripmatch/category-attractions.png" },
  { id: "nature", label: "טבע ונופים", imageSrc: "/images/tripmatch/category-nature.png" },
  { id: "nightlife", label: "חיי לילה ובילויים", imageSrc: "/images/tripmatch/category-nightlife.png" },
  { id: "hotel", label: "מלונות", imageSrc: "/images/places-menu-hotel.png" },
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
  imageUrl: string | null;
  type: "place" | "destination";
}

interface SuggestPlaceSheetProps {
  onClose: () => void;
  /** אופציונלי - חוזר לתפריט "מה תרצה ליצור?" במקום לסגור לגמרי. */
  onBack?: () => void;
}

/** "מקום חדש" - Bottom Sheet (לא עמוד נפרד, בקשה מפורשת). */
export function SuggestPlaceSheet({ onClose, onBack }: SuggestPlaceSheetProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [category, setCategory] = useState<PlaceSubmissionCategory | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GoogleDetails | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<DuplicateMatch | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);

  const [description, setDescription] = useState("");
  const [media, setMedia] = useState<(UploadedMedia & { previewUrl: string })[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleNameChange(value: string) {
    setNameQuery(value);
    setSelected(null);
    setDuplicateOf(null);
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
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  async function handleSubmit() {
    if (!category) {
      setError("בחר קטגוריה");
      return;
    }
    if (!selected) {
      setError(duplicateOf ? "המקום הזה כבר קיים - אי אפשר להציע אותו שוב" : "בחר מקום מתוך ההשלמה האוטומטית");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/social/place-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selected.name,
          category,
          address: selected.address,
          latitude: selected.latitude,
          longitude: selected.longitude,
          description: description.trim() || undefined,
          googlePlaceId: selected.placeId,
          googlePhotoUrl: selected.photoUrl ?? undefined,
          mediaIds: media.map((m) => m.id),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "שגיאה בשליחת ההצעה");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <BottomSheet onClose={onClose}>
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="text-3xl">✅</span>
          <h1 className="text-[16px] font-bold text-ink">ההצעה נשלחה!</h1>
          <p className="max-w-xs text-[13.5px] text-ink-secondary">
            הפרטים והתמונה שהעלית נשמרו וממתינים לבדיקה של הצוות. ברגע שהמקום יאושר, הוא ייכנס למאגר ויופיע בעמוד היעד שלו ב-triplace.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-pill px-6 py-2.5 text-[13px] font-bold text-white"
            style={{ background: PLACES_PURPLE_GRADIENT }}
          >
            סגור
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="max-h-[85vh] overflow-y-auto px-5 pb-2">
        {onBack && (
          <div className="mb-1 flex justify-end">
            <BackButton onBack={onBack} />
          </div>
        )}
        <span className="text-[12px] font-bold" style={{ color: "var(--color-places-purple)" }}>
          מקום חדש
        </span>
        <h1 className="mb-1 mt-0.5 text-[24px] font-extrabold leading-tight text-ink">הצע מקום חדש</h1>
        <p className="mb-4 text-[13px] text-ink-secondary">מצאת מקום שעדיין לא קיים אצלנו? ספר לנו עליו</p>

        <label className="mb-2 block text-[12.5px] font-semibold text-ink-secondary">סוג המקום</label>
        <div className="mb-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <ImageOptionRow
              key={c.id}
              selected={category === c.id}
              onClick={() => setCategory(c.id)}
              label={c.label}
              imageSrc={c.imageSrc}
              icon={c.icon}
              selectedGradient={PLACES_PURPLE_GRADIENT}
            />
          ))}
        </div>

        <label className="mb-1 block text-[12.5px] font-semibold text-ink-secondary">שם המקום</label>
        <div className="relative">
          <Input value={nameQuery} onChange={(e) => handleNameChange(e.target.value)} placeholder="לדוגמה: קפה השעון" />
          {(searching || suggestions) && (
            <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-card bg-white shadow-soft ring-1 ring-black/5">
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
              {!searching && suggestions?.length === 0 && (
                <p className="p-3 text-center text-[12.5px] text-ink-secondary">לא נמצאו תוצאות</p>
              )}
            </div>
          )}
        </div>

        {checkingDuplicate && <p className="mt-2 text-[12px] text-ink-secondary">בודק אם המקום כבר קיים אצלנו...</p>}

        {duplicateOf && (
          <div className="mt-3 overflow-hidden rounded-card shadow-soft">
            <div className="relative h-32 w-full bg-bg-secondary">
              {duplicateOf.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={duplicateOf.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl">📍</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="text-[11px] font-bold text-white/90">המקום הזה כבר קיים אצלנו</p>
                <p className="truncate text-[15px] font-bold text-white">{duplicateOf.name}</p>
              </div>
            </div>
            <div className="flex gap-2 bg-white p-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/place/${duplicateOf.id}`);
                }}
                className="flex-1 rounded-pill border border-ink-secondary/20 py-2 text-[12.5px] font-bold text-ink"
              >
                פתח את המקום
              </button>
              {duplicateOf.type === "place" && (
                <button
                  type="button"
                  onClick={() => setReviewSheetOpen(true)}
                  className="flex-1 rounded-pill py-2 text-[12.5px] font-bold text-white"
                  style={{ background: PLACES_PURPLE_GRADIENT }}
                >
                  ⭐ כתוב ביקורת
                </button>
              )}
            </div>
          </div>
        )}

        {selected && (
          <div className="mt-2 flex items-center gap-2 rounded-card bg-bg-secondary px-3 py-2.5">
            <span style={{ color: "var(--color-places-purple)" }}>📍</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-ink">{selected.name}</span>
              <span className="block truncate text-[11.5px] text-ink-secondary">{selected.address}</span>
            </span>
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-[12.5px] font-semibold text-ink-secondary">קצת עליו (אופציונלי)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="למה כדאי לבקר שם?"
            className="w-full resize-none rounded-card border border-ink-secondary/15 p-3 text-[13.5px] focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-[12.5px] font-semibold text-ink-secondary">תמונות</label>
          {media.length > 0 && (
            <div className="mb-2 grid grid-cols-4 gap-2">
              {media.map((m) => (
                <div key={m.id} className="relative aspect-square overflow-hidden rounded-card bg-bg-secondary">
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
          )}
          <div className="flex gap-2">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <button
              type="button"
              disabled={uploadingMedia || media.length >= 4}
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-40"
              style={{ borderColor: "var(--color-places-purple)", color: "var(--color-places-purple)" }}
            >
              <Image src="/images/places-camera-icon.png" alt="" width={16} height={14} className="object-contain" />
              צלם
            </button>
            <button
              type="button"
              disabled={uploadingMedia || media.length >= 4}
              onClick={() => galleryInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-40"
              style={{ borderColor: "var(--color-places-purple)", color: "var(--color-places-purple)" }}
            >
              <Image src="/images/places-gallery-icon.png" alt="" width={15} height={14} className="object-contain" />
              {uploadingMedia ? "מעלה..." : "גלריה"}
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-[12.5px] text-red-500">{error}</p>}

        <div className="mt-5">
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="w-full rounded-pill py-3 text-[14px] font-bold text-white disabled:opacity-50"
            style={{ background: PLACES_PURPLE_GRADIENT }}
          >
            {submitting ? "שולח..." : "שלח הצעה"}
          </button>
        </div>
      </div>

      {reviewSheetOpen && duplicateOf && (
        <CreateReviewSheet
          placeId={duplicateOf.id}
          placeName={duplicateOf.name}
          onClose={() => setReviewSheetOpen(false)}
          onSubmitted={onClose}
        />
      )}
    </BottomSheet>
  );
}
