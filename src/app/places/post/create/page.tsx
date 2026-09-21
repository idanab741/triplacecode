"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getAvatarUrl } from "@/constants/avatar";
import { createClient } from "@/services/supabase/client";
import { uploadMultipleSocialMedia, type UploadedMedia } from "@/services/social/mediaUploadService";
import { searchPlaces, type PlaceSearchResult } from "@/services/places/searchService";
import type { PostVisibility } from "@/services/social/types";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { PlacesLocationIcon } from "@/screens/places/PlacesIcons";

/** "יצירת פוסט" - + -> פוסט. עמוד מלא (לא Sheet) עם הבר העליון של Places והבר התחתון הראשי
 *  (טאב "תוכן" פעיל), בדיוק כמו שאר עמודי היצירה (/places/create, טיול, אוסף).
 *  פשוט, מהיר וחברתי - בלי כותרת, בלי סוג פוסט, בלי קטגוריה, בלי דירוג. המשתמש
 *  כותב / מוסיף מדיה / מתייג מקום (אם רוצה) ומפרסם.
 *  פרטיות: אותה מערכת קיימת (posts.visibility: public / friends / private) -
 *  "כולם" = public. שמירה: אותם posts / post_media / posts.place_id הקיימים
 *  (ר' POST /api/social/posts) - לא נוצר שום Entity חדש. */
const VISIBILITY_OPTIONS: { id: PostVisibility; label: string }[] = [
  { id: "public", label: "כולם" },
  { id: "friends", label: "חברים" },
  { id: "private", label: "פרטי" },
];

const MAX_FILES = 10;
const PLACES_PURPLE_GRADIENT = "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))";

type LocalMedia = UploadedMedia & { previewUrl: string };

export default function CreatePostPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [place, setPlace] = useState<{ id: string; name: string } | null>(null);
  const [placePickerOpen, setPlacePickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const displayName = profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? "";
  const hasContent = text.trim().length > 0 || media.length > 0;
  // Place בלבד, בלי טקסט ובלי מדיה = לא פוסט תקין.
  const canPublish = hasContent && !uploading && !submitting;
  const visibilityLabel = VISIBILITY_OPTIONS.find((o) => o.id === visibility)?.label ?? "כולם";

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 120)}px`;
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || !user) return;
    const selected = Array.from(files).slice(0, MAX_FILES - media.length);
    if (selected.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const uploaded = await uploadMultipleSocialMedia(supabase, user.id, selected);
      const withPreview = uploaded.map((m, i) => {
        const previewUrl = URL.createObjectURL(selected[i]);
        previewUrlsRef.current.push(previewUrl);
        return { ...m, previewUrl };
      });
      setMedia((prev) => [...prev, ...withPreview]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאת המדיה");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeMedia(id: string) {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }

  /** direction -1 = קודם (ימינה ב-RTL), +1 = מאוחר יותר (שמאלה). */
  function moveMedia(index: number, direction: -1 | 1) {
    setMedia((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  /** כפתור החזרה של הבר העליון (החליף את "ביטול"). */
  function handleBack() {
    if (hasContent && !window.confirm("לבטל את הפוסט? מה שכתבתם לא יישמר.")) return;
    router.back();
  }

  async function handleSubmit() {
    if (!canPublish) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          visibility,
          postType: media.length ? "photo" : "post",
          mediaIds: media.map((m) => m.id),
          // placeId = תיוג מקום אופציונלי - לא הופך את הפוסט לביקורת.
          placeId: place?.id ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "שגיאה בפרסום הפוסט");
      router.replace("/places?published=post");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בפרסום הפוסט");
      setSubmitting(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-white">
        <HomeStatusBarTint color="#7C3AED" />
        <PlacesHeader variant="purple" onBack={() => router.back()} />
        <div className="px-5 pt-6">
          <Skeleton className="mb-4 h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <MainBottomNav active="content" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      <HomeStatusBarTint color="#7C3AED" />
      <PlacesHeader variant="purple" onBack={handleBack} />

      <div className="px-4 pt-5">
        {/* כותרת העמוד (ימין) + פרסום (שמאל) */}
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-extrabold leading-tight text-ink">יצירת פוסט</h1>
          <button
            type="button"
            disabled={!canPublish}
            onClick={handleSubmit}
            className="rounded-pill px-5 py-2 text-[14px] font-bold transition-colors"
            style={
              canPublish
                ? { background: PLACES_PURPLE_GRADIENT, color: "white" }
                : { background: "var(--color-bg-secondary, #f2f2f5)", color: "var(--color-ink-secondary, #8a94a6)" }
            }
          >
            {submitting ? "מפרסם..." : "פרסום"}
          </button>
        </div>

        {/* USER INFORMATION */}
        <div className="mt-5 flex items-center gap-3">
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAvatarUrl(profile?.avatar_url)} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="relative min-w-0">
            <p className="truncate text-[15px] font-bold text-ink">{displayName}</p>
            <button
              type="button"
              onClick={() => setVisibilityMenuOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={visibilityMenuOpen}
              className="mt-0.5 flex items-center gap-1 rounded-pill bg-bg-secondary px-2.5 py-0.5 text-[12px] font-semibold text-ink-secondary"
            >
              {visibilityLabel}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {visibilityMenuOpen && (
              <>
                <div className="fixed inset-0 z-[5]" onClick={() => setVisibilityMenuOpen(false)} />
                <div role="listbox" className="absolute start-0 top-full z-10 mt-1 min-w-[120px] overflow-hidden rounded-card bg-white shadow-lg ring-1 ring-black/5">
                  {VISIBILITY_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={visibility === option.id}
                      onClick={() => {
                        setVisibility(option.id);
                        setVisibilityMenuOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-start text-[13.5px] text-ink hover:bg-bg-secondary"
                    >
                      <span className={visibility === option.id ? "font-bold" : "font-medium"}>{option.label}</span>
                      {visibility === option.id && <span style={{ color: "var(--color-places-purple)" }}>✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* TEXT AREA - בלי כותרת, בלי מסגרת כבדה */}
        <textarea
          ref={textareaRef}
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            autoGrow();
          }}
          placeholder="מה בא לכם לשתף?"
          rows={4}
          className="mt-4 block min-h-[120px] w-full resize-none bg-transparent text-[16px] leading-relaxed text-ink placeholder:text-ink-secondary focus:outline-none"
        />

        {/* MEDIA */}
        {media.length > 0 && (
          <div className={`mt-2 grid gap-2 ${media.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
            {media.map((m, index) => (
              <div
                key={m.id}
                className={`relative overflow-hidden rounded-card bg-bg-secondary ${media.length === 1 ? "aspect-[4/3]" : "aspect-square"}`}
              >
                {m.type === "video" ? (
                  <video src={m.previewUrl} className="h-full w-full object-cover" muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.previewUrl} alt="" className="h-full w-full object-cover" />
                )}
                {m.type === "video" && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[22px] text-white drop-shadow">▶</span>
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(m.id)}
                  aria-label="הסר"
                  className="absolute end-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[12px] text-white"
                >
                  ✕
                </button>
                {media.length > 1 && index > 0 && (
                  <button
                    type="button"
                    onClick={() => moveMedia(index, -1)}
                    aria-label="הזז קדימה"
                    className="absolute bottom-1 start-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[12px] text-white"
                  >
                    →
                  </button>
                )}
                {media.length > 1 && index < media.length - 1 && (
                  <button
                    type="button"
                    onClick={() => moveMedia(index, 1)}
                    aria-label="הזז אחורה"
                    className="absolute bottom-1 end-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[12px] text-white"
                  >
                    ←
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
        <button
          type="button"
          disabled={uploading || media.length >= MAX_FILES}
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-card border border-dashed px-4 py-3 text-[14px] font-semibold disabled:opacity-40"
          style={{ borderColor: "var(--color-places-purple)", color: "var(--color-places-purple)" }}
        >
          {uploading ? "מעלה..." : "+ הוסיפו תמונות או סרטון"}
          {media.length > 0 && !uploading && (
            <span className="text-[11.5px] font-medium opacity-70">
              {media.length}/{MAX_FILES}
            </span>
          )}
        </button>

        {/* ACTIONS - מוכן להרחבה עתידית (תגיות, רגש) בלי ליצור אותם עכשיו */}
        <div className="mt-2 border-t border-ink-secondary/10 pt-1">
          {place ? (
            <div className="flex items-center gap-3 py-2.5 text-[14.5px] font-semibold text-ink">
              <PlacesLocationIcon />
              <span className="min-w-0 flex-1 truncate">{place.name}</span>
              <button
                type="button"
                onClick={() => setPlace(null)}
                aria-label="הסר מקום"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-secondary text-[12px] text-ink-secondary"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPlacePickerOpen(true)}
              className="flex w-full items-center gap-3 py-2.5 text-start text-[14.5px] font-semibold text-ink"
            >
              <PlacesLocationIcon />
              הוספת מקום
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-[12.5px] text-red-500">{error}</p>}
      </div>

      <MainBottomNav active="content" />

      {placePickerOpen && (
        <PlacePickerView
          onClose={() => setPlacePickerOpen(false)}
          onPick={(p) => {
            setPlace(p);
            setPlacePickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** תיוג מקום - בחירת Place קיים בלבד (מאותו חיפוש של places שכבר קיים באפליקציה). */
function PlacePickerView({ onClose, onPick }: { onClose: () => void; onPick: (place: { id: string; name: string }) => void }) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 350);
  const [results, setResults] = useState<PlaceSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = debounced.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchPlaces({ query: term, categories: [], minRating: null, maxPriceLevel: null, kosher: false, accessible: false }, 0, 15)
      .then((found) => {
        if (!cancelled) setResults(found);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-white">
      <div
        className="flex shrink-0 items-center justify-between border-b border-ink-secondary/10 px-4 pb-2.5"
        style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
      >
        <h1 className="flex items-center gap-2 text-[17px] font-bold text-ink">
          <PlacesLocationIcon size={30} />
          הוספת מקום
        </h1>
        <button type="button" onClick={onClose} className="text-[14px] font-semibold text-ink-secondary">
          ביטול
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-4">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חפשו מקום..."
          className="mb-3 w-full rounded-pill border border-ink-secondary/20 px-4 py-2.5 text-[14px] focus:outline-none"
        />

        {searching && <p className="py-4 text-center text-[12.5px] text-ink-secondary">מחפש...</p>}

        {results?.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick({ id: p.id, name: p.name })}
            className="flex w-full items-center gap-3 rounded-card px-2 py-2.5 text-start hover:bg-bg-secondary"
          >
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-card bg-bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.image_urls?.[0] && <img src={p.image_urls[0]} alt="" className="h-full w-full object-cover" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-ink">{p.name}</span>
              {p.city && <span className="text-[12px] text-ink-secondary">{p.city}</span>}
            </span>
          </button>
        ))}

        {results !== null && !searching && results.length === 0 && (
          <p className="py-4 text-center text-[12.5px] text-ink-secondary">לא מצאנו מקום כזה</p>
        )}
      </div>
    </div>
  );
}
