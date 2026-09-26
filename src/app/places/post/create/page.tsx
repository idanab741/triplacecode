"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
import { takePendingCreateMedia } from "@/screens/create/pendingCreateMedia";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";

/** "יצירת פוסט" - + -> פוסט. עמוד מלא (לא Sheet) עם הבר העליון של Places והבר התחתון הראשי
 *  (טאב "תוכן" פעיל), בדיוק כמו שאר עמודי היצירה (/places/create, טיול, אוסף).
 *  פשוט, מהיר וחברתי - בלי כותרת, בלי סוג פוסט, בלי קטגוריה, בלי דירוג. המשתמש
 *  כותב / מוסיף מדיה / מתייג מקום (אם רוצה) ומפרסם.
 *  פרטיות: אותה מערכת קיימת (posts.visibility: public / friends / private) -
 *  "כולם" = public. שמירה: אותם posts / post_media / posts.place_id הקיימים
 *  (ר' POST /api/social/posts) - לא נוצר שום Entity חדש. */
/* *** עיצוב מחדש (בקשה מפורשת - "נתאים לעיצוב של האפליקציה"): העמוד עבר מהבר הסגול של place's
 * לבר העליון של triplace (CollapsibleTopBar עם חזור) ולאותה שפה כמו "הבחירות שלי" / "מה חדש?":
 * רקע לבן, טקסט חד (INK), כחול האפליקציה (#0A6DFE) לפעולה הראשית, משטחים אפורים-בהירים (#F1F2F5).
 * שום לוגיקה לא השתנתה - אותה העלאה, אותו תיוג מקום, אותו POST /api/social/posts. */
const BLUE = "#0A6DFE";
const INK = { "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties;

const VISIBILITY_OPTIONS: { id: PostVisibility; label: string; hint: string; icon: ReactNode }[] = [
  { id: "public", label: "כולם", hint: "כל מי שב-triplace", icon: <GlobeIcon /> },
  { id: "friends", label: "חברים", hint: "רק החברים שלכם", icon: <FriendsIcon /> },
  { id: "private", label: "פרטי", hint: "רק אתם", icon: <LockIcon /> },
];

const MAX_FILES = 10;

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
  /** *** מיידי (בקשה מפורשת - "העלאת סרטון לוקחת יותר מדי זמן ולא נטען בסוף"): הקבצים מוצגים מיד כשבוחרים
   *  אותם, עם סימן העלאה - ולא רק אחרי שכל ההעלאה הסתיימה. */
  const [pending, setPending] = useState<{ key: string; previewUrl: string; isVideo: boolean }[]>([]);
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
  const visibilityOption = VISIBILITY_OPTIONS.find((o) => o.id === visibility) ?? VISIBILITY_OPTIONS[0];
  const mediaCount = media.length + pending.length;

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 120)}px`;
  }

  // קבצים שנבחרו ב"רגע" בעמוד התוכן (מצלמה / גלריה) - נכנסים לפוסט מיד כשהמשתמש מוכן.
  const pendingTakenRef = useRef(false);
  useEffect(() => {
    if (!user || pendingTakenRef.current) return;
    pendingTakenRef.current = true;
    const files = takePendingCreateMedia();
    if (files) void handleFilesSelected(files);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- רץ פעם אחת, כשהמשתמש נטען
  }, [user]);

  async function handleFilesSelected(files: FileList | File[] | null) {
    if (!files || !user) return;
    const selected = Array.from(files).slice(0, MAX_FILES - media.length);
    if (selected.length === 0) return;

    setUploading(true);
    setError(null);
    const previews = selected.map((file, i) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.push(previewUrl);
      return { key: `${Date.now()}-${i}`, previewUrl, isVideo: file.type.startsWith("video/") };
    });
    setPending((prev) => [...prev, ...previews]);
    try {
      const supabase = createClient();
      const uploaded = await uploadMultipleSocialMedia(supabase, user.id, selected);
      setMedia((prev) => [...prev, ...uploaded.map((m, i) => ({ ...m, previewUrl: previews[i].previewUrl }))]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        /size|exceeded|too large|413/i.test(message)
          ? "הקובץ גדול מדי. נסו סרטון קצר יותר (עד דקה)."
          : "ההעלאה נכשלה. בדקו את החיבור ונסו שוב."
      );
    } finally {
      const keys = new Set(previews.map((p) => p.key));
      setPending((prev) => prev.filter((p) => !keys.has(p.key)));
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
      router.replace("/home?published=post");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בפרסום הפוסט");
      setSubmitting(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-white" style={INK}>
        <HomeStatusBarTint />
        <CollapsibleTopBar onBack={() => router.back()} />
        <div className="mx-auto max-w-xl px-5 pt-4">
          <Skeleton className="mb-2 h-8 w-40" />
          <Skeleton className="mb-6 h-4 w-56" />
          <Skeleton className="h-52 w-full" />
        </div>
        <MainBottomNav active="content" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32" style={INK}>
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={handleBack} />

      <div className="mx-auto max-w-xl px-5 pt-4">
        {/* כותרת העמוד (ימין) + פרסום (שמאל) - באותו סגנון כותרת כמו "הבחירות שלי" */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">יצירת פוסט</h1>
            <p className="mt-1 text-[14px] text-ink-secondary">שתפו רגע מהדרך</p>
          </div>
          <button
            type="button"
            disabled={!canPublish}
            onClick={handleSubmit}
            className={`mt-1 h-10 shrink-0 rounded-xl px-5 text-[15px] font-semibold transition-opacity ${
              canPublish
                ? "bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white shadow-soft"
                : "bg-[#F1F2F5] text-[#9aa1ad]"
            }`}
          >
            {submitting ? "מפרסם..." : "פרסום"}
          </button>
        </header>

        {/* הכותב + למי זה מוצג */}
        <div className="mt-6 flex items-center gap-3">
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#EFF1F4]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAvatarUrl(profile?.avatar_url)} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="relative min-w-0">
            <p className="truncate text-[15px] font-semibold text-ink">{displayName}</p>
            <button
              type="button"
              onClick={() => setVisibilityMenuOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={visibilityMenuOpen}
              className="mt-1 flex h-7 items-center gap-1.5 rounded-full bg-[#F1F2F5] px-2.5 text-[12.5px] font-semibold text-ink transition active:scale-95"
            >
              <span className="text-ink-secondary">{visibilityOption.icon}</span>
              {visibilityOption.label}
              <ChevronIcon />
            </button>
            {visibilityMenuOpen && (
              <>
                <div className="fixed inset-0 z-[5]" onClick={() => setVisibilityMenuOpen(false)} />
                <div
                  role="listbox"
                  className="absolute start-0 top-full z-10 mt-2 w-[220px] overflow-hidden rounded-[18px] bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(15,20,25,0.22)] ring-1 ring-black/[0.06]"
                >
                  {VISIBILITY_OPTIONS.map((option) => {
                    const selected = visibility === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setVisibility(option.id);
                          setVisibilityMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-start active:bg-[#F1F2F5]"
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                          style={selected ? { background: BLUE, color: "white" } : { background: "#F1F2F5", color: "#0f1419" }}
                        >
                          {option.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold text-ink">{option.label}</span>
                          <span className="block text-[12px] text-ink-secondary">{option.hint}</span>
                        </span>
                        {selected && <CheckIcon />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* הטקסט - בלי מסגרת, כמו בפיד */}
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
          className="mt-4 block min-h-[120px] w-full resize-none bg-transparent text-[17px] leading-relaxed text-ink placeholder:text-[#9aa1ad] focus:outline-none"
        />

        {/* מדיה */}
        {mediaCount > 0 && (
          <div className={`mt-2 grid gap-1.5 ${mediaCount === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
            {media.map((m, index) => (
              <div
                key={m.id}
                className={`relative overflow-hidden rounded-[16px] bg-[#EFF1F4] ${mediaCount === 1 ? "aspect-[4/3]" : "aspect-square"}`}
              >
                {m.type === "video" ? (
                  <video src={`${m.previewUrl}#t=0.1`} preload="metadata" className="h-full w-full object-cover" muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.previewUrl} alt="" className="h-full w-full object-cover" />
                )}
                {m.type === "video" && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
                      <PlayIcon />
                    </span>
                  </span>
                )}
                <MediaIconButton label="הסר" className="end-1.5 top-1.5" onClick={() => removeMedia(m.id)}>
                  <CloseIcon />
                </MediaIconButton>
                {media.length > 1 && index > 0 && (
                  <MediaIconButton label="הזז קדימה" className="bottom-1.5 start-1.5" onClick={() => moveMedia(index, -1)}>
                    <ArrowIcon direction="right" />
                  </MediaIconButton>
                )}
                {media.length > 1 && index < media.length - 1 && (
                  <MediaIconButton label="הזז אחורה" className="bottom-1.5 end-1.5" onClick={() => moveMedia(index, 1)}>
                    <ArrowIcon direction="left" />
                  </MediaIconButton>
                )}
              </div>
            ))}
            {pending.map((p) => (
              <div
                key={p.key}
                className={`relative overflow-hidden rounded-[16px] bg-[#EFF1F4] ${mediaCount === 1 ? "aspect-[4/3]" : "aspect-square"}`}
              >
                {p.isVideo ? (
                  <video src={`${p.previewUrl}#t=0.1`} preload="metadata" className="h-full w-full object-cover" muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 text-[12.5px] font-semibold text-white">
                  <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
                  {p.isVideo ? "מעלה סרטון..." : "מעלה..."}
                </span>
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

        {/* הוספה לפוסט - שורות פעולה בסגנון רשימות האפליקציה */}
        <div className="mt-5 overflow-hidden rounded-[20px] bg-[#F7F8FA]">
          <ActionRow
            icon={<ImageIcon />}
            title={uploading ? "מעלה..." : "תמונות או סרטון"}
            subtitle={media.length > 0 ? `${media.length} מתוך ${MAX_FILES}` : `עד ${MAX_FILES} קבצים`}
            disabled={uploading || media.length >= MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
          />
          <span className="mx-4 block h-px bg-black/[0.06]" />
          {place ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <ActionIcon>
                <PinIcon />
              </ActionIcon>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] text-ink-secondary">מתויג ב</span>
                <span className="block truncate text-[15px] font-semibold text-ink">{place.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setPlace(null)}
                aria-label="הסר מקום"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink-secondary shadow-[0_1px_3px_rgba(15,20,25,0.12)] active:scale-95"
              >
                <CloseIcon />
              </button>
            </div>
          ) : (
            <ActionRow icon={<PinIcon />} title="תיוג מקום" subtitle="איפה זה קרה?" onClick={() => setPlacePickerOpen(true)} />
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-[14px] bg-[#FDECEC] px-3.5 py-2.5 text-[13px] font-medium text-[#C8373C]">
            {error}
          </p>
        )}
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

/* ───────────── חלקים קטנים ───────────── */

function ActionIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(10,109,254,0.1)", color: BLUE }}>
      {children}
    </span>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 px-4 py-3 text-start transition active:bg-black/[0.03] disabled:opacity-45"
    >
      <ActionIcon>{icon}</ActionIcon>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        {subtitle && <span className="block text-[12.5px] text-ink-secondary">{subtitle}</span>}
      </span>
      <span className="text-[#b3b9c3]">
        <ArrowIcon direction="left" />
      </span>
    </button>
  );
}

function MediaIconButton({ label, className, onClick, children }: { label: string; className: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm active:scale-90 ${className}`}
    >
      {children}
    </button>
  );
}

/* ───────────── אייקונים (קו, currentColor) ───────────── */

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
function GlobeIcon() {
  return (
    <Svg size={14}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </Svg>
  );
}
function FriendsIcon() {
  return (
    <Svg size={14}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </Svg>
  );
}
function LockIcon() {
  return (
    <Svg size={14}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}
function ChevronIcon() {
  return (
    <Svg size={12}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}
function CheckIcon() {
  return (
    <span style={{ color: BLUE }}>
      <Svg size={18}>
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </Svg>
    </span>
  );
}
function CloseIcon() {
  return (
    <Svg size={14}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}
function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return <Svg size={16}>{direction === "left" ? <path d="m15 6-6 6 6 6" /> : <path d="m9 6 6 6-6 6" />}</Svg>;
}
function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <Svg size={20}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m20.5 15.5-4.5-4.5L6 19.5" />
    </Svg>
  );
}
function PinIcon() {
  return (
    <Svg size={20}>
      <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </Svg>
  );
}
function SearchIcon() {
  return (
    <Svg size={18}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </Svg>
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
    <div className="fixed inset-0 z-[80] flex flex-col bg-white" style={INK}>
      <div
        className="flex shrink-0 items-center justify-between px-5 pb-3"
        style={{ paddingTop: "max(var(--sat), 14px)" }}
      >
        <h1 className="text-[20px] font-bold tracking-tight text-ink">תיוג מקום</h1>
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-full bg-[#F1F2F5] px-4 text-[14px] font-semibold text-ink active:scale-95"
        >
          ביטול
        </button>
      </div>

      <div className="shrink-0 px-5 pb-2">
        <label className="flex h-12 items-center gap-2.5 rounded-full bg-[#F1F2F5] px-4 text-ink-secondary focus-within:ring-2 focus-within:ring-[#0A6DFE]/30">
          <SearchIcon />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפשו מקום..."
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-[#9aa1ad] focus:outline-none"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-8 pt-2">
        {results === null && !searching && (
          <p className="px-2 py-6 text-center text-[13.5px] text-ink-secondary">הקלידו לפחות 2 אותיות כדי לחפש</p>
        )}

        {searching && (
          <div className="flex flex-col gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2.5">
                <span className="h-12 w-12 shrink-0 animate-pulse rounded-[14px] bg-[#EFF1F4]" />
                <span className="flex flex-1 flex-col gap-2">
                  <span className="h-3.5 w-2/3 animate-pulse rounded bg-[#EFF1F4]" />
                  <span className="h-3 w-1/4 animate-pulse rounded bg-[#F4F5F7]" />
                </span>
              </div>
            ))}
          </div>
        )}

        {!searching &&
          results?.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick({ id: p.id, name: p.name })}
              className="flex w-full items-center gap-3 rounded-[16px] px-2 py-2.5 text-start transition active:bg-[#F1F2F5]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#EFF1F4] text-[#9aa1ad]">
                {p.image_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_urls[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <PinIcon />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink">{p.name}</span>
                {p.city && <span className="block truncate text-[12.5px] text-ink-secondary">{p.city}</span>}
              </span>
            </button>
          ))}

        {results !== null && !searching && results.length === 0 && (
          <p className="px-2 py-6 text-center text-[13.5px] text-ink-secondary">לא מצאנו מקום כזה. נסו שם אחר.</p>
        )}
      </div>
    </div>
  );
}
