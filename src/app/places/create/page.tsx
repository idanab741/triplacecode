"use client";

import { useEffect, useRef, useState, Suspense, type CSSProperties, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ImageOptionRow, Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { getAvatarUrl } from "@/constants/avatar";
import { createClient } from "@/services/supabase/client";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { searchPlaces, dedupePlaceResults, type PlaceSearchResult } from "@/services/places/searchService";
import { uploadMultipleSocialMedia, type UploadedMedia } from "@/services/social/mediaUploadService";
import { getPlaceCategoryLabel } from "@/constants/placeCategories";
import { HOME_QUICK_CATEGORIES, type HomeQuickCategoryId } from "@/constants/homeQuickCategories";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";
import type { PlaceSubmissionCategory } from "@/services/social/placeSubmissionService";

/* *** עיצוב מחדש (בקשה מפורשת - "נתאים לעיצוב של האפליקציה"): כמו עמוד יצירת הפוסט - הבר העליון של
 * triplace (עם חזור), רקע לבן, טקסט חד, כחול האפליקציה לפעולות ומשטחים אפורים-בהירים במקום מסגרות.
 * הזרימה (חיפוש -> הוספה -> ביקורת) וכל הלוגיקה/ה-API לא השתנו. */
const BLUE = "#0A6DFE";
const INK = { "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties;
const MAX_MEDIA = 4;
/** מה אומר כל דירוג - מוצג מתחת לכוכבים. */
const RATING_LABELS = ["", "לא משהו", "סביר", "טוב", "טוב מאוד", "מושלם!"];

/** סוגי המקומות - הטקסונומיה החדשה (אותם אייקונים ותוויות כמו בעמוד הבית), לא הסט הישן.
 *  id = הערך שנשמר בשרת (PlaceSubmissionCategory), home = המזהה בטקסונומיה החדשה. */
const CATEGORY_OPTIONS: { id: PlaceSubmissionCategory; home: HomeQuickCategoryId }[] = [
  { id: "attraction", home: "attraction" },
  { id: "hotel", home: "sleep" },
  { id: "nature", home: "nature" },
  { id: "nightlife", home: "nightlife" },
  { id: "shopping", home: "shopping" },
  { id: "restaurant", home: "food" },
];

const CSS = `
.pc-reveal { animation: pc-reveal .4s cubic-bezier(.2,.8,.2,1) both; }
@keyframes pc-reveal { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .pc-reveal { animation: none; } }
`;

const FIELD_CLASS =
  "h-12 w-full rounded-full bg-[#F1F2F5] text-[15px] text-ink placeholder:text-[#9aa1ad] focus:outline-none focus:ring-2 focus:ring-[#0A6DFE]/30";

interface AutocompleteSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface GoogleDetails {
  placeId: string | null;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
}

/** המקום שעליו כותבים - נבחר מהחיפוש, או נוסף עכשיו. */
interface SelectedPlace {
  id: string;
  name: string;
  city: string | null;
  categoryLabel: string | null;
  imageUrl: string | null;
}

/* ───────────── אייקונים (קו, currentColor) ───────────── */

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const STAR_PATH = "M12 2.8l2.84 5.76 6.36.92-4.6 4.49 1.08 6.33L12 17.31l-5.68 2.99 1.08-6.33-4.6-4.49 6.36-.92L12 2.8z";
function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#F5B301" aria-hidden="true">
      <path d={STAR_PATH} />
    </svg>
  );
}
function CheckIcon() {
  return (
    <Svg size={18}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
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
function PinIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </Svg>
  );
}
function PlusIcon() {
  return (
    <Svg size={20}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}
function GlobeIcon() {
  return (
    <Svg size={18}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </Svg>
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
function CloseIcon() {
  return (
    <Svg size={14}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}
function ChevronIcon() {
  return (
    <Svg size={16}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
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

/** שורת פעולה בכרטיס אפור-בהיר - אותה שורה כמו ב"הוספה לפוסט". */
function ActionRow({ icon, title, subtitle, onClick, disabled }: { icon: ReactNode; title: string; subtitle?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-[20px] bg-[#F7F8FA] px-4 py-3 text-start transition active:bg-[#EFF1F4] disabled:opacity-45"
    >
      <ActionIcon>{icon}</ActionIcon>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        {subtitle && <span className="block text-[12.5px] text-ink-secondary">{subtitle}</span>}
      </span>
      <span className="text-[#b3b9c3]">
        <ChevronIcon />
      </span>
    </button>
  );
}

/** הכפתור הראשי הקבוע של האפליקציה (components/ui/Button) - לא עיצוב נפרד לעמוד הזה. */
function PrimaryButton({ children, onClick, disabled, className = "" }: { children: ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <Button type="button" fullWidth onClick={onClick} disabled={disabled} className={className}>
      {children}
    </Button>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-[14px] font-semibold text-ink">{children}</label>;
}

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-3 rounded-[14px] bg-[#FDECEC] px-3.5 py-2.5 text-[13px] font-medium text-[#C8373C]">
      {children}
    </p>
  );
}

/**
 * "על איזה מקום בא לכם לספר?" - עמוד אחד לכל הזרימה (+ -> מקום), שנחשפת שלב אחרי שלב:
 *  1. חיפוש מקום (תוצאה אחת לכל מקום) + "לא מצאתם את המקום? לחצו כאן".
 *  2. לא נמצא -> נחשף טופס "הוסיפו מקום" (שם, סוג, רשת חברתית/אתר) -> המקום נוצר מיד.
 *  3. מקום נבחר (או נוסף) -> נחשף "איך היה לכם?" (כוכבים), ואחרי דירוג - הטקסט, התמונות והפרסום.
 * המשתמש לא צריך להבין אם המקום קיים או חדש. הבר העליון והתחתון קבועים לאורך כל השלבים.
 */
export function CreatePlacePageContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // *** תוספת (בקשה מפורשת - "אם לא מצאתי מקום, כשאני כבר יוצר טיול - אל תחזיר אותי אחורה לעמוד
  // 'מקום' - תן לי להוסיף בטיול עצמו כבר"): כשמגיעים לכאן דרך "לא מוצאים את המקום? הוסיפו אותו
  // ל-TRIPLACE" מתוך יצירת/עריכת טיול (TripForm.handleGoAddPlace), ?returnTo=... הוא נתיב הטיול
  // שממנו יצאנו. עם הפרמטר הזה - בסיום (handlePublish למטה) חוזרים לשם עם המקום כבר מוכן להוספה
  // כתחנה, במקום ל-/places?published=1 הרגיל.
  const returnTo = searchParams.get("returnTo");

  // 1. חיפוש
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);

  // 2. הוספת מקום חדש
  // ?add=1 - "המקום לא קיים? הוסיפו אותו" מעמוד התוכן: נפתח ישר בטופס ההוספה.
  const [addOpen, setAddOpen] = useState(() => searchParams.get("add") === "1");
  const [category, setCategory] = useState<PlaceSubmissionCategory | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [googlePlace, setGooglePlace] = useState<GoogleDetails | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateOf, setDuplicateOf] = useState<{ id: string; name: string; type: "place" | "destination" } | null>(null);
  const [website, setWebsite] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // *** תוספת (בקשה מפורשת - "אין אותו באופציות של גוגל - אני רוצה
  // שיהיה אפשרות להוסיף ידנית"): כשהמקום לא נמצא ברשימת ההצעות של
  // גוגל, מאפשרים להקליד כתובת חופשית ולגאוקד אותה בלבד (בלי Place ID
  // ספציפי) - אותו endpoint בדיוק ש-AddPlaceModal כבר משתמש בו למצב הזה.
  const [manualMode, setManualMode] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [manualLocating, setManualLocating] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // 3. ביקורת
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  // *** בקשה מפורשת ("לאחד בין רגע לביקורת - שייראה כמו רגע, פלוס כוכבים, מיקום חובה"): העמוד הוא
  // עורך אחד בסגנון יצירת הפוסט; בחירת המקום (חיפוש / הוספה ידנית) היא שלב נפרד שנפתח ממנו.
  // מגיעים מעמוד התוכן ("על איזה מקום?", ?pick=1) או מ"הוספת מקום" (?add=1) - ישר לבחירת המקום.
  const [picking, setPicking] = useState(() => searchParams.get("pick") === "1" || searchParams.get("add") === "1");
  const [justAdded, setJustAdded] = useState(false);
  // ?rating=1..5 - הכוכבים שנבחרו כבר בעמוד התוכן ("מקום"). נשמרים עד שבוחרים מקום.
  const [rating, setRating] = useState(() => {
    const r = Number(searchParams.get("rating"));
    return Number.isInteger(r) && r >= 1 && r <= 5 ? r : 0;
  });
  const [comment, setComment] = useState("");
  const [media, setMedia] = useState<(UploadedMedia & { previewUrl: string })[]>([]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  const addRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // כל שלב שנחשף מגלגל את המסך אליו.
  useEffect(() => {
    if (addOpen) addRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [addOpen]);

  const hasReviewContent = rating > 0 || comment.trim().length > 0 || media.length > 0;
  const canPublish = !!selected && rating > 0 && !uploading && !publishing;
  const displayName = profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? "";

  // ───────── ניווט ─────────

  /** חזרה שלב-שלב: ביקורת -> חיפוש, הוספה -> חיפוש, חיפוש -> יציאה מהעמוד. */
  function handleBack() {
    if (picking) {
      if (addOpen) {
        setAddOpen(false);
        return;
      }
      // מבחירת המקום חוזרים לעורך (אם כבר יש בו משהו), אחרת יוצאים מהעמוד
      if (selected || hasReviewContent) {
        setPicking(false);
        return;
      }
      router.back();
      return;
    }
    if (hasReviewContent && !window.confirm("לבטל את הביקורת? מה שכתבתם לא יישמר.")) return;
    router.back();
  }

  // ───────── 1. חיפוש ─────────

  function handleQueryChange(value: string) {
    setQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) {
      searchSeqRef.current++;
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeqRef.current;
    searchTimerRef.current = setTimeout(async () => {
      try {
        // מביאים יותר מהמוצג - כפילויות תופסות מקום, ורק אחרי הסינון חותכים.
        const found = await searchPlaces(
          { query: value.trim(), categories: [], minRating: null, maxPriceLevel: null, kosher: false, accessible: false },
          0,
          30
        );
        if (seq === searchSeqRef.current) setResults(dedupePlaceResults(found).slice(0, 10));
      } catch {
        if (seq === searchSeqRef.current) setResults([]);
      } finally {
        if (seq === searchSeqRef.current) setSearching(false);
      }
    }, 300);
  }

  function selectFromSearch(place: PlaceSearchResult) {
    setJustAdded(false);
    setPicking(false);
    setSelected({
      id: place.id,
      name: place.name,
      city: place.city,
      categoryLabel: getPlaceCategoryLabel(place.category),
      imageUrl: place.image_urls?.[0] ?? null,
    });
  }

  /** מקום שנוסף עכשיו / כבר קיים אצלנו - טוענים את הפרטים שלו וממשיכים ישר לביקורת. */
  async function selectById(id: string, fallbackName: string, fromAdd: boolean) {
    let next: SelectedPlace = { id, name: fallbackName, city: null, categoryLabel: null, imageUrl: null };
    try {
      const { data } = await createClient().from("places").select("id,name,city,category,image_urls").eq("id", id).maybeSingle();
      if (data) {
        next = {
          id,
          name: data.name ?? fallbackName,
          city: data.city || null,
          categoryLabel: data.category ? getPlaceCategoryLabel(data.category) : null,
          imageUrl: (data.image_urls as string[] | null)?.[0] ?? null,
        };
      }
    } catch {
      // ממשיכים עם מה שיש - השם מספיק לביקורת.
    }
    setAddOpen(false);
    setJustAdded(fromAdd);
    setPicking(false);
    setSelected(next);
  }

  // ───────── 2. הוספת מקום ─────────

  function openAdd() {
    setNameQuery(query);
    if (query.trim().length >= 3) handleNameChange(query);
    setAddOpen(true);
  }

  function handleNameChange(value: string) {
    setNameQuery(value);
    setGooglePlace(null);
    setDuplicateOf(null);
    setAddError(null);
    setManualMode(false);
    setManualAddress("");
    setManualError(null);
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    if (value.trim().length < 3) {
      setSuggestions(null);
      return;
    }
    suggestTimerRef.current = setTimeout(async () => {
      setSuggesting(true);
      try {
        const res = await fetch(`/api/places/google-autocomplete?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggesting(false);
      }
    }, 400);
  }

  async function handleSelectSuggestion(s: AutocompleteSuggestion) {
    setSuggestions(null);
    setNameQuery(s.mainText);
    setCheckingDuplicate(true);
    setAddError(null);
    try {
      const details = await fetch(`/api/places/search-result-details?placeId=${encodeURIComponent(s.placeId)}`).then((r) => r.json());
      const dupParams = new URLSearchParams({ placeId: s.placeId });
      if (details.name) dupParams.set("name", details.name);
      if (details.latitude != null) dupParams.set("lat", String(details.latitude));
      if (details.longitude != null) dupParams.set("lng", String(details.longitude));
      const dup = await fetch(`/api/social/place-submissions/check-duplicate?${dupParams}`).then((r) => r.json());

      if (dup.exists) {
        setDuplicateOf(dup.place);
        setGooglePlace(null);
        return;
      }
      setGooglePlace({
        placeId: s.placeId,
        name: details.name ?? s.mainText,
        address: details.address ?? s.secondaryText,
        latitude: details.latitude,
        longitude: details.longitude,
        imageUrl: details.imageUrl ?? null,
      });
    } catch {
      setAddError("שגיאה בטעינת פרטי המקום");
    } finally {
      setCheckingDuplicate(false);
    }
  }

  /** גאוקוד כתובת חופשית בלבד (בלי Place ID) - אותו endpoint שמשמש את
   *  AddPlaceModal למצב "אין GPS/לא נמצא בגוגל" (ר' match-place/route.ts). */
  async function handleManualLocate() {
    if (!manualAddress.trim()) {
      setManualError("הזינו כתובת");
      return;
    }
    setManualLocating(true);
    setManualError(null);
    try {
      const res = await fetch("/api/tripadd/match-place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: manualAddress.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.latitude == null) {
        setManualError(data.error ?? "לא הצלחנו לאתר את הכתובת הזו");
        return;
      }
      setDuplicateOf(null);
      setGooglePlace({
        placeId: null,
        name: nameQuery.trim(),
        address: data.address ?? manualAddress.trim(),
        latitude: data.latitude,
        longitude: data.longitude,
        imageUrl: null,
      });
    } catch {
      setManualError("שגיאת רשת באיתור הכתובת");
    } finally {
      setManualLocating(false);
    }
  }

  async function handleAddPlace() {
    if (!nameQuery.trim()) return setAddError("מה שם המקום?");
    if (!category) return setAddError("מה סוג המקום?");
    if (!googlePlace) return setAddError("בחרו את המקום מתוך ההצעות כדי שנדע איפה הוא נמצא");
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/social/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: googlePlace.name,
          category,
          googlePlaceId: googlePlace.placeId ?? undefined,
          address: googlePlace.address,
          latitude: googlePlace.latitude,
          longitude: googlePlace.longitude,
          website: website.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "שגיאה בהוספת המקום");
      // המקום נוצר (או שכבר היה קיים) - ממשיכים ישר לביקורת, באותו עמוד.
      await selectById(data.id, data.name, true);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setAdding(false);
    }
  }

  // ───────── 3. ביקורת ─────────

  async function handleFilesSelected(files: FileList | null) {
    if (!files || !user) return;
    const picked = Array.from(files).slice(0, MAX_MEDIA - media.length);
    if (picked.length === 0) return;
    setUploading(true);
    setReviewError(null);
    try {
      // מערכת המדיה הקיימת של Reviews - לא ליצור חדשה.
      const uploaded = await uploadMultipleSocialMedia(createClient(), user.id, picked);
      const withPreview = uploaded.map((m, i) => {
        const previewUrl = URL.createObjectURL(picked[i]);
        previewUrlsRef.current.push(previewUrl);
        return { ...m, previewUrl };
      });
      setMedia((prev) => [...prev, ...withPreview]);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "שגיאה בהעלאת המדיה");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handlePublish() {
    if (!selected || rating === 0) return;
    setPublishing(true);
    setReviewError(null);
    try {
      const res = await fetch("/api/social/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: selected.id, rating, comment: comment.trim(), mediaIds: media.map((m) => m.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "שגיאה בפרסום הביקורת");
      }
      // *** תיקון (ר' ההערה המלאה למעלה על returnTo): הגענו מיצירת/עריכת טיול - במקום הפיד, חוזרים
      // ישר לטופס הטיול, עם המקום שנוסף/נבחר כאן ממתין להוספה אוטומטית כתחנה (TripForm קורא את זה).
      if (returnTo && selected) {
        try {
          sessionStorage.setItem(
            "trip_new_place_v1",
            JSON.stringify({ id: selected.id, name: selected.name, subtitle: [selected.categoryLabel, selected.city].filter(Boolean).join(" · ") || null, imageUrl: selected.imageUrl })
          );
        } catch {
          // sessionStorage חסום - הטיול עדיין ייפתח, פשוט בלי הוספה אוטומטית
        }
        router.replace(returnTo);
        return;
      }
      // חזרה ל-Places Feed - שם מוצגת הודעת ההצלחה והפיד נטען מחדש (הביקורת בראש).
      router.replace("/home?published=1");
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "שגיאה");
      setPublishing(false);
    }
  }

  // ───────── תצוגה ─────────

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-white" style={INK}>
        <HomeStatusBarTint />
        <CollapsibleTopBar onBack={() => router.back()} />
        <div className="mx-auto max-w-xl px-5 pt-4">
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="mb-6 h-4 w-48" />
          <Skeleton className="h-12 w-full" />
        </div>
        <MainBottomNav active="content" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32" style={INK}>
      <style>{CSS}</style>
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={handleBack} />

      <div className="mx-auto max-w-xl px-5 pt-4">
        {picking && (
          <header className="mb-5">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">איפה הייתם?</h1>
            <p className="mt-1 text-[14px] text-ink-secondary">{addOpen ? "הוסיפו מקום חדש ל-triplace" : "חפשו את המקום - או הוסיפו אותו אם הוא חדש"}</p>
          </header>
        )}

        {/* ───── שלב 1: חיפוש ───── */}
        {picking && !addOpen && (
          <section className="pc-reveal">
            <label className="flex h-12 items-center gap-2.5 rounded-full bg-[#F1F2F5] px-4 text-ink-secondary focus-within:ring-2 focus-within:ring-[#0A6DFE]/30">
              <SearchIcon />
              <input
                autoFocus
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="חפשו מקום..."
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-[#9aa1ad] focus:outline-none"
              />
            </label>

            <div className="-mx-2 mt-3">
              {searching &&
                [0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2.5">
                    <span className="h-14 w-14 shrink-0 animate-pulse rounded-[16px] bg-[#EFF1F4]" />
                    <span className="flex flex-1 flex-col gap-2">
                      <span className="h-3.5 w-2/3 animate-pulse rounded bg-[#EFF1F4]" />
                      <span className="h-3 w-1/3 animate-pulse rounded bg-[#F4F5F7]" />
                    </span>
                  </div>
                ))}

              {!searching &&
                results?.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => selectFromSearch(place)}
                    className="flex w-full items-center gap-3 rounded-[18px] px-2 py-2.5 text-start transition active:bg-[#F1F2F5]"
                  >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-[#EFF1F4] text-[#9aa1ad]">
                      {place.image_urls?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={place.image_urls[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <PinIcon />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{place.name}</span>
                      <span className="block truncate text-[12.5px] text-ink-secondary">
                        {[getPlaceCategoryLabel(place.category), place.city].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {place.rating != null && (
                      <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ink">
                        <StarIcon />
                        {place.rating.toFixed(1)}
                      </span>
                    )}
                  </button>
                ))}
            </div>

            {results !== null && !searching && results.length === 0 && (
              <p className="py-4 text-center text-[14px] text-ink-secondary">לא מצאנו מקום בשם הזה</p>
            )}

            <div className="mt-4">
              <ActionRow icon={<PlusIcon />} title="לא מצאתם את המקום?" subtitle="הוסיפו אותו ל-triplace" onClick={openAdd} />
            </div>
          </section>
        )}

        {/* ───── שלב 2: הוספת מקום (נחשף בלחיצה) ───── */}
        {picking && addOpen && (
          <section ref={addRef} className="pc-reveal scroll-mt-28">
            <FieldLabel>מה שם המקום?</FieldLabel>
            <div className="relative mb-1">
              <input
                value={nameQuery}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="לדוגמה: קפה השעון"
                className={`${FIELD_CLASS} px-4`}
              />
              {(suggesting || suggestions) && (
                <div className="absolute inset-x-0 top-full z-10 mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-[18px] bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(15,20,25,0.22)] ring-1 ring-black/[0.06]">
                  {suggesting && <p className="p-3 text-center text-[13px] text-ink-secondary">מחפש...</p>}
                  {!suggesting &&
                    suggestions?.map((s) => (
                      <button
                        key={s.placeId}
                        type="button"
                        onClick={() => handleSelectSuggestion(s)}
                        className="flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-start active:bg-[#F1F2F5]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F2F5] text-ink-secondary">
                          <PinIcon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-ink">{s.mainText}</span>
                          <span className="block truncate text-[12px] text-ink-secondary">{s.secondaryText}</span>
                        </span>
                      </button>
                    ))}
                  {!suggesting && suggestions?.length === 0 && (
                    <p className="px-3 pb-1 pt-2.5 text-center text-[13px] text-ink-secondary">לא מצאנו את המקום בגוגל</p>
                  )}
                  {/* *** בקשה מפורשת - "אם המקום לא ברשימה, אפשרות להוספה ידנית כחלק מהגלילה": שורה
                      אחרונה בתוך הרשימה עצמה (לא קישור מתחתיה, שהרשימה מסתירה). פותחת את הכתובת הידנית. */}
                  {!suggesting && suggestions && (
                    <>
                      {suggestions.length > 0 && <span className="mx-2.5 my-1 block h-px bg-black/[0.06]" />}
                      <button
                        type="button"
                        onClick={() => {
                          setSuggestions(null);
                          setManualMode(true);
                        }}
                        className="flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-start active:bg-[#F1F2F5]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(10,109,254,0.1)", color: BLUE }}>
                          <PlusIcon />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold" style={{ color: BLUE }}>
                            לא ברשימה? הוסיפו ידנית
                          </span>
                          <span className="block truncate text-[12px] text-ink-secondary">
                            נוסיף את &quot;{nameQuery.trim()}&quot; לפי כתובת שתזינו
                          </span>
                        </span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {checkingDuplicate && <p className="mb-2 mt-2 text-[13px] text-ink-secondary">בודקים אם המקום כבר קיים...</p>}

            {/* *** תוספת (בקשה מפורשת - הוספה ידנית כשהמקום לא נמצא בגוגל). */}
            {!googlePlace && !duplicateOf && nameQuery.trim().length >= 3 && (
              <div className="mb-3 mt-2">
                {!manualMode ? (
                  <button type="button" onClick={() => setManualMode(true)} className="py-1 text-[13.5px]">
                    <span className="text-ink-secondary">לא מצאתם את זה ברשימה? </span>
                    <span className="font-semibold" style={{ color: BLUE }}>
                      הוסיפו כתובת ידנית
                    </span>
                  </button>
                ) : (
                  <div className="pc-reveal rounded-[20px] bg-[#F7F8FA] p-3.5">
                    <FieldLabel>מה הכתובת?</FieldLabel>
                    <div className="flex gap-2">
                      <input
                        value={manualAddress}
                        onChange={(e) => setManualAddress(e.target.value)}
                        placeholder="רחוב, עיר, מדינה"
                        className={`${FIELD_CLASS} flex-1 !bg-white px-4`}
                      />
                      <button
                        type="button"
                        disabled={manualLocating}
                        onClick={handleManualLocate}
                        className="h-12 shrink-0 rounded-xl bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] px-5 text-[15px] font-semibold text-white shadow-soft transition-opacity disabled:opacity-50"
                      >
                        {manualLocating ? "מאתר..." : "אתרו"}
                      </button>
                    </div>
                    {manualError && <ErrorBox>{manualError}</ErrorBox>}
                  </div>
                )}
              </div>
            )}

            {/* המערכת מחליטה מאחורי הקלעים: אם המקום כבר קיים - ממשיכים לביקורת, בלי להסביר. */}
            {duplicateOf && (
              <div className="pc-reveal mb-3 mt-2 rounded-[20px] bg-[#F7F8FA] p-3.5">
                <div className="flex items-center gap-3">
                  <ActionIcon>
                    <PinIcon />
                  </ActionIcon>
                  <p className="min-w-0 flex-1 text-[14px] text-ink">
                    <span className="font-semibold">{duplicateOf.name}</span> כבר נמצא ב-triplace
                  </p>
                </div>
                {duplicateOf.type === "place" && (
                  <PrimaryButton className="mt-3" onClick={() => selectById(duplicateOf.id, duplicateOf.name, false)}>
                    כתיבת ביקורת
                  </PrimaryButton>
                )}
              </div>
            )}

            {googlePlace && (
              <div className="pc-reveal mb-3 mt-2 flex items-center gap-3 rounded-[20px] bg-[#F7F8FA] px-3.5 py-3">
                {googlePlace.imageUrl ? (
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#EFF1F4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={googlePlace.imageUrl} alt="" className="h-full w-full object-cover" />
                  </span>
                ) : (
                  <ActionIcon>
                    <PinIcon />
                  </ActionIcon>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-ink-secondary">איפה הוא נמצא?</span>
                  <span className="block truncate text-[14px] font-semibold text-ink">{googlePlace.address}</span>
                </span>
                <span style={{ color: BLUE }}>
                  <CheckIcon />
                </span>
              </div>
            )}

            <div className="mt-5">
              <FieldLabel>מה סוג המקום?</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((c) => (
                  <ImageOptionRow
                    key={c.id}
                    selected={category === c.id}
                    onClick={() => setCategory(c.id)}
                    label={HOME_QUICK_CATEGORY_LABELS[c.home]}
                    imageSrc={HOME_QUICK_CATEGORIES.find((h) => h.id === c.home)?.imageSrc}
                    selectedGradient={BLUE}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5">
              <FieldLabel>
                רשת חברתית / אתר <span className="font-normal text-ink-secondary">(לא חובה)</span>
              </FieldLabel>
              <label className="flex h-12 items-center gap-2.5 rounded-full bg-[#F1F2F5] px-4 text-ink-secondary focus-within:ring-2 focus-within:ring-[#0A6DFE]/30">
                <GlobeIcon />
                {/* dir=ltr + יישור לימין: הכתובת נכתבת ונקראת נכון (https://), ליד האייקון. */}
                <input
                  type="text"
                  inputMode="url"
                  dir="ltr"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                  className="h-full min-w-0 flex-1 bg-transparent text-right text-[15px] text-ink placeholder:text-[#9aa1ad] focus:outline-none"
                />
              </label>
            </div>

            {addError && <ErrorBox>{addError}</ErrorBox>}

            <PrimaryButton className="mt-6" disabled={adding || checkingDuplicate || !!duplicateOf} onClick={handleAddPlace}>
              {adding ? "מוסיפים..." : "הוספת מקום"}
            </PrimaryButton>
            <button type="button" onClick={() => setAddOpen(false)} className="mt-2 h-11 w-full text-[14px] font-semibold text-ink-secondary">
              חזרה לחיפוש
            </button>
          </section>
        )}

        {/* ───── העורך - באותו מבנה כמו יצירת פוסט ("רגע"), פלוס מקום (חובה) ודירוג (חובה) ───── */}
        {!picking && (
          <section className="pc-reveal">
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">ביקורת</h1>
                <p className="mt-1 text-[14px] text-ink-secondary">דרגו מקום וספרו איך היה</p>
              </div>
              <button
                type="button"
                disabled={!canPublish}
                onClick={handlePublish}
                className={`mt-1 h-10 shrink-0 rounded-xl px-5 text-[15px] font-semibold transition-opacity ${
                  canPublish
                    ? "bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white shadow-soft"
                    : "bg-[#F1F2F5] text-[#9aa1ad]"
                }`}
              >
                {publishing ? "מפרסם..." : "פרסום"}
              </button>
            </header>

            {/* הכותב */}
            <div className="mt-6 flex items-center gap-3">
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#EFF1F4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getAvatarUrl(profile?.avatar_url)} alt="" className="h-full w-full object-cover" />
              </span>
              <p className="min-w-0 truncate text-[15px] font-semibold text-ink">{displayName}</p>
            </div>

            {justAdded && (
              <div className="mt-4 flex items-center gap-2 rounded-[14px] px-3.5 py-2.5 text-[13.5px] font-semibold" style={{ background: "rgba(10,109,254,0.08)", color: BLUE }}>
                <CheckIcon />
                הוספנו את המקום ל-triplace!
              </div>
            )}

            {/* המקום - חובה */}
            {selected ? (
              <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-[#F7F8FA] p-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-[#EFF1F4] text-[#9aa1ad]">
                  {selected.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <PinIcon />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold text-ink">{selected.name}</span>
                  <span className="block truncate text-[12.5px] text-ink-secondary">{[selected.city, selected.categoryLabel].filter(Boolean).join(" · ")}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="h-9 shrink-0 rounded-full bg-white px-3.5 text-[13px] font-semibold text-ink shadow-[0_1px_3px_rgba(15,20,25,0.12)] active:scale-95"
                >
                  שינוי
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="mt-4 flex w-full items-center gap-3 rounded-[20px] border-2 border-dashed border-[#C9D6F5] p-3 text-start transition active:scale-[0.99] active:bg-[#F4F7FF]"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px]" style={{ background: "rgba(10,109,254,0.1)", color: BLUE }}>
                  <PinIcon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-ink">איפה הייתם?</span>
                  <span className="block text-[12.5px] text-ink-secondary">חובה - חפשו את המקום או הוסיפו אותו</span>
                </span>
                <span className="text-[#b3b9c3]">
                  <ChevronIcon />
                </span>
              </button>
            )}

            {/* הדירוג - חובה */}
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-[15px] font-semibold text-ink" id="rating-label">
                איך היה?
              </span>
              <span className="h-5 text-[14px] font-semibold text-[#E09A00]" aria-live="polite">
                {RATING_LABELS[rating]}
              </span>
            </div>
            <div className="mt-2 flex justify-between gap-1" dir="ltr" role="radiogroup" aria-labelledby="rating-label">
              {[1, 2, 3, 4, 5].map((star) => {
                const on = star <= rating;
                return (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={star === rating}
                    onClick={() => setRating(star)}
                    aria-label={`${star} כוכבים - ${RATING_LABELS[star]}`}
                    className="flex flex-1 justify-center rounded-[14px] py-1 transition active:scale-90"
                  >
                    <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={STAR_PATH} fill={on ? "#F5B301" : "#E6E8EC"} stroke={on ? "#F5B301" : "#E6E8EC"} strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                  </button>
                );
              })}
            </div>

            {/* הטקסט - בלי מסגרת, כמו בפוסט */}
            <textarea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.max(e.target.scrollHeight, 110)}px`;
              }}
              placeholder="מה אהבתם? מה כדאי לדעת לפני שמגיעים?"
              rows={4}
              className="mt-5 block min-h-[110px] w-full resize-none bg-transparent text-[17px] leading-relaxed text-ink placeholder:text-[#9aa1ad] focus:outline-none"
            />

            {/* מדיה - אותה רשת כמו בפוסט */}
            {media.length > 0 && (
              <div className={`mt-2 grid gap-1.5 ${media.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
                {media.map((m) => (
                  <div key={m.id} className={`relative overflow-hidden rounded-[16px] bg-[#EFF1F4] ${media.length === 1 ? "aspect-[4/3]" : "aspect-square"}`}>
                    {m.type === "video" ? (
                      <video src={`${m.previewUrl}#t=0.1`} preload="metadata" className="h-full w-full object-cover" muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.previewUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => setMedia((prev) => prev.filter((x) => x.id !== m.id))}
                      aria-label="הסר"
                      className="absolute end-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm active:scale-90"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
            <div className="mt-5 overflow-hidden rounded-[20px] bg-[#F7F8FA]">
              <ActionRow
                icon={<ImageIcon />}
                title={uploading ? "מעלה..." : "תמונות או סרטון"}
                subtitle={media.length > 0 ? `${media.length} מתוך ${MAX_MEDIA}` : `עד ${MAX_MEDIA} קבצים`}
                disabled={uploading || media.length >= MAX_MEDIA}
                onClick={() => fileInputRef.current?.click()}
              />
            </div>

            {reviewError && <ErrorBox>{reviewError}</ErrorBox>}
            {!canPublish && !publishing && (
              <p className="mt-4 text-center text-[13px] text-ink-secondary">
                {!selected ? "כדי לפרסם - בחרו מקום ודרגו אותו" : rating === 0 ? "כדי לפרסם - דרגו את המקום" : ""}
              </p>
            )}
          </section>
        )}
      </div>

      <MainBottomNav active="content" />
    </div>
  );
}

/** עוטפים ב-Suspense כי useSearchParams (returnTo) דורש את זה ב-App Router - אותו עיקרון בדיוק
 *  כמו places/collection/create/page.tsx. */
export default function CreatePlacePage() {
  return (
    <Suspense>
      <CreatePlacePageContent />
    </Suspense>
  );
}
