"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input, ImageOptionRow, Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { PlacesCameraIcon, PlacesGlobeIcon, PlacesLocationIcon, PlacesSearchIcon } from "@/screens/places/PlacesIcons";
import { searchPlaces, dedupePlaceResults, type PlaceSearchResult } from "@/services/places/searchService";
import { uploadMultipleSocialMedia, type UploadedMedia } from "@/services/social/mediaUploadService";
import { getPlaceCategoryLabel } from "@/constants/placeCategories";
import { HOME_QUICK_CATEGORIES, type HomeQuickCategoryId } from "@/constants/homeQuickCategories";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";
import type { PlaceSubmissionCategory } from "@/services/social/placeSubmissionService";

const PURPLE_GRADIENT = "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))";
const MAX_MEDIA = 4;

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
  "w-full rounded-pill border border-ink-secondary/25 bg-bg py-3 text-[15px] text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/30";

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

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#F5B301" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-places-purple)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12.5 2.8 2.8L16 9.5" />
    </svg>
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
  const { user, loading: authLoading } = useAuth();
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
  const [addOpen, setAddOpen] = useState(false);
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
  const [justAdded, setJustAdded] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [media, setMedia] = useState<(UploadedMedia & { previewUrl: string })[]>([]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  const addRef = useRef<HTMLElement>(null);
  const reviewRef = useRef<HTMLElement>(null);

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
  useEffect(() => {
    if (selected) reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected]);

  const hasReviewContent = rating > 0 || comment.trim().length > 0 || media.length > 0;

  // ───────── ניווט ─────────

  /** חזרה שלב-שלב: ביקורת -> חיפוש, הוספה -> חיפוש, חיפוש -> יציאה מהעמוד. */
  function handleBack() {
    if (selected) {
      if (hasReviewContent && !window.confirm("לבטל את הביקורת? מה שכתבתם לא יישמר.")) return;
      resetReview();
      setSelected(null);
      setJustAdded(false);
      return;
    }
    if (addOpen) {
      setAddOpen(false);
      return;
    }
    router.back();
  }

  function resetReview() {
    setRating(0);
    setComment("");
    setMedia([]);
    setReviewError(null);
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
      router.replace("/places?published=1");
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "שגיאה");
      setPublishing(false);
    }
  }

  // ───────── תצוגה ─────────

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
      <style>{CSS}</style>
      <HomeStatusBarTint color="#7C3AED" />
      <PlacesHeader variant="purple" onBack={handleBack} />

      <div className="px-5 pt-6">
        <h1 className="mb-4 text-[22px] font-extrabold leading-tight text-ink">על איזה מקום בא לכם לספר?</h1>

        {/* ───── שלב 1: חיפוש ───── */}
        {!selected && !addOpen && (
          <section className="pc-reveal">
            <div className="relative mb-4">
              <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center">
                <PlacesSearchIcon />
              </span>
              <input
                autoFocus
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="חפשו מקום..."
                className={`${FIELD_CLASS} ps-11 pe-4`}
                style={{ borderColor: query ? "var(--color-places-purple)" : undefined }}
              />
            </div>

            {searching && (
              <div>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="mb-2 h-16 w-full" />
                ))}
              </div>
            )}

            {!searching &&
              results?.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => selectFromSearch(place)}
                  className="flex w-full items-center gap-3 rounded-card px-1 py-2.5 text-start hover:bg-bg-secondary"
                >
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-card bg-bg-secondary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {place.image_urls?.[0] && <img src={place.image_urls[0]} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-ink">{place.name}</span>
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

            {results !== null && !searching && results.length === 0 && (
              <p className="py-4 text-center text-[14px] text-ink-secondary">לא מצאנו מקום בשם הזה</p>
            )}

            <button type="button" onClick={openAdd} className="mt-5 w-full text-center text-[13.5px]">
              <span className="text-ink-secondary">לא מצאתם את המקום? </span>
              <span className="font-bold" style={{ color: "var(--color-places-purple)" }}>
                לחצו כאן
              </span>
            </button>
          </section>
        )}

        {/* ───── שלב 2: הוספת מקום (נחשף בלחיצה) ───── */}
        {!selected && addOpen && (
          <section ref={addRef} className="pc-reveal scroll-mt-28">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-extrabold text-ink">הוסיפו מקום</h2>
              <button type="button" onClick={() => setAddOpen(false)} className="text-[13px] font-semibold" style={{ color: "var(--color-places-purple)" }}>
                חזרה לחיפוש
              </button>
            </div>

            <label className="mb-1 block text-[13px] font-semibold text-ink-secondary">מה שם המקום?</label>
            <div className="relative mb-1">
              <Input value={nameQuery} onChange={(e) => handleNameChange(e.target.value)} placeholder="לדוגמה: קפה השעון" />
              {(suggesting || suggestions) && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-card bg-white shadow-soft ring-1 ring-black/5">
                  {suggesting && <p className="p-3 text-center text-[12.5px] text-ink-secondary">מחפש...</p>}
                  {!suggesting &&
                    suggestions?.map((s) => (
                      <button key={s.placeId} type="button" onClick={() => handleSelectSuggestion(s)} className="block w-full px-3 py-2.5 text-start hover:bg-bg-secondary">
                        <span className="block text-[13.5px] font-semibold text-ink">{s.mainText}</span>
                        <span className="block text-[11.5px] text-ink-secondary">{s.secondaryText}</span>
                      </button>
                    ))}
                  {!suggesting && suggestions?.length === 0 && <p className="p-3 text-center text-[12.5px] text-ink-secondary">לא נמצאו תוצאות</p>}
                </div>
              )}
            </div>

            {checkingDuplicate && <p className="mb-2 text-[12px] text-ink-secondary">בודקים אם המקום כבר קיים...</p>}

            {/* *** תוספת (בקשה מפורשת - הוספה ידנית כשהמקום לא נמצא בגוגל). */}
            {!googlePlace && !duplicateOf && nameQuery.trim().length >= 3 && (
              <div className="mb-3">
                {!manualMode ? (
                  <button type="button" onClick={() => setManualMode(true)} className="text-[13px]">
                    <span className="text-ink-secondary">לא מצאתם את זה ברשימה? </span>
                    <span className="font-bold" style={{ color: "var(--color-places-purple)" }}>
                      הוסיפו כתובת ידנית
                    </span>
                  </button>
                ) : (
                  <div className="pc-reveal rounded-card bg-bg-secondary p-3">
                    <label className="mb-1 block text-[12.5px] font-semibold text-ink-secondary">מה הכתובת?</label>
                    <div className="flex gap-2">
                      <input
                        value={manualAddress}
                        onChange={(e) => setManualAddress(e.target.value)}
                        placeholder="רחוב, עיר, מדינה"
                        className={`${FIELD_CLASS} flex-1 px-4`}
                      />
                      <button
                        type="button"
                        disabled={manualLocating}
                        onClick={handleManualLocate}
                        className="shrink-0 rounded-pill px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
                        style={{ background: PURPLE_GRADIENT }}
                      >
                        {manualLocating ? "מאתר..." : "אתרו"}
                      </button>
                    </div>
                    {manualError && <p className="mt-2 text-[12px] text-red-500">{manualError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* המערכת מחליטה מאחורי הקלעים: אם המקום כבר קיים - ממשיכים לביקורת, בלי להסביר. */}
            {duplicateOf && (
              <div className="mb-3 mt-2 rounded-card bg-bg-secondary p-3">
                <p className="text-[13px] text-ink">מצאנו את &quot;{duplicateOf.name}&quot; - הוא כבר אצלנו</p>
                {duplicateOf.type === "place" && (
                  <button
                    type="button"
                    onClick={() => selectById(duplicateOf.id, duplicateOf.name, false)}
                    className="mt-2 w-full rounded-pill py-2.5 text-[13.5px] font-bold text-white"
                    style={{ background: PURPLE_GRADIENT }}
                  >
                    כתיבת ביקורת
                  </button>
                )}
              </div>
            )}

            {googlePlace && (
              <div className="pc-reveal mb-3 mt-2 flex items-center gap-2.5 rounded-card bg-bg-secondary px-3 py-2.5">
                {googlePlace.imageUrl ? (
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-bg-secondary ring-1 ring-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={googlePlace.imageUrl} alt="" className="h-full w-full object-cover" />
                  </span>
                ) : (
                  <PlacesLocationIcon size={32} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-ink-secondary">איפה הוא נמצא?</span>
                  <span className="block truncate text-[13px] font-semibold text-ink">{googlePlace.address}</span>
                </span>
              </div>
            )}

            <label className="mb-2 mt-4 block text-[13px] font-semibold text-ink-secondary">מה סוג המקום?</label>
            <div className="mb-4 flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((c) => (
                <ImageOptionRow
                  key={c.id}
                  selected={category === c.id}
                  onClick={() => setCategory(c.id)}
                  label={HOME_QUICK_CATEGORY_LABELS[c.home]}
                  imageSrc={HOME_QUICK_CATEGORIES.find((h) => h.id === c.home)?.imageSrc}
                  selectedGradient={PURPLE_GRADIENT}
                />
              ))}
            </div>

            <label className="mb-1 block text-[13px] font-semibold text-ink-secondary">רשת חברתית / אתר אינטרנט (אופציונלי)</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center">
                <PlacesGlobeIcon />
              </span>
              {/* dir=ltr + יישור לימין: הכתובת נכתבת ונקראת נכון (https://), ליד האייקון. */}
              <input
                type="text"
                inputMode="url"
                dir="ltr"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
                className={`${FIELD_CLASS} pl-4 pr-11 text-right`}
              />
            </div>

            {addError && <p className="mt-3 text-[12.5px] text-red-500">{addError}</p>}

            <button
              type="button"
              disabled={adding || checkingDuplicate || !!duplicateOf}
              onClick={handleAddPlace}
              className="mt-6 w-full rounded-pill py-3.5 text-[15px] font-bold text-white disabled:opacity-50"
              style={{ background: PURPLE_GRADIENT }}
            >
              {adding ? "מוסיפים..." : "הוספת מקום"}
            </button>
          </section>
        )}

        {/* ───── שלב 3: ביקורת (נחשף אחרי בחירת מקום) ───── */}
        {selected && (
          <section ref={reviewRef} className="pc-reveal scroll-mt-28">
            {justAdded && (
              <div className="mb-4 flex items-center gap-2 rounded-card px-3 py-2.5 text-[13.5px] font-semibold" style={{ background: "rgba(124,58,237,0.08)", color: "var(--color-places-purple-dark)" }}>
                <CheckIcon />
                הוספנו את המקום! רוצים לספר איך היה לכם?
              </div>
            )}

            {/* Place Preview קטן - בלי לחזור על כל פרטי המקום. */}
            <div className="mb-6 flex items-center gap-3">
              <span className="h-14 w-14 shrink-0 overflow-hidden rounded-card bg-bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {selected.imageUrl && <img src={selected.imageUrl} alt="" className="h-full w-full object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold text-ink">{selected.name}</span>
                <span className="block truncate text-[12.5px] text-ink-secondary">{[selected.city, selected.categoryLabel].filter(Boolean).join(" · ")}</span>
              </span>
              <button type="button" onClick={handleBack} className="shrink-0 text-[13px] font-semibold" style={{ color: "var(--color-places-purple)" }}>
                שינוי
              </button>
            </div>

            <h2 className="mb-3 text-[20px] font-extrabold text-ink">איך היה לכם?</h2>
            <div className="mb-6 flex justify-center gap-2" dir="ltr">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} כוכבים`}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill={star <= rating ? "var(--color-places-purple)" : "none"} stroke="var(--color-places-purple)" strokeWidth="1.5">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>

            {/* נחשף אחרי שנבחר דירוג */}
            {rating > 0 && (
              <div className="pc-reveal">
                <label className="mb-1.5 block text-[14px] font-semibold text-ink">ספרו קצת יותר...</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="מה אהבתם? מה כדאי לדעת לפני שמגיעים?"
                  rows={4}
                  className="w-full resize-none rounded-card border border-ink-secondary/15 p-3 text-[16px] text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
                />

                {media.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {media.map((m) => (
                      <div key={m.id} className="relative aspect-square overflow-hidden rounded-card bg-bg-secondary">
                        {m.type === "video" ? (
                          <video src={m.previewUrl} className="h-full w-full object-cover" muted />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.previewUrl} alt="" className="h-full w-full object-cover" />
                        )}
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

                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
                <button
                  type="button"
                  disabled={uploading || media.length >= MAX_MEDIA}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 flex items-center gap-2 rounded-pill border px-3.5 py-2 text-[13px] font-semibold disabled:opacity-40"
                  style={{ borderColor: "var(--color-places-purple)", color: "var(--color-places-purple)" }}
                >
                  <PlacesCameraIcon />
                  {uploading ? "מעלה..." : "הוסיפו תמונות"}
                </button>

                {reviewError && <p className="mt-3 text-[12.5px] text-red-500">{reviewError}</p>}

                <button
                  type="button"
                  disabled={publishing || uploading}
                  onClick={handlePublish}
                  className="mt-6 w-full rounded-pill py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
                  style={{ background: PURPLE_GRADIENT }}
                >
                  {publishing ? "מפרסמים..." : "פרסום ביקורת"}
                </button>
              </div>
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
