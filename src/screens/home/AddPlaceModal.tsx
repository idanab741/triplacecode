"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageOptionRow } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { uploadMultipleSocialMedia, type UploadedMedia } from "@/services/social/mediaUploadService";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";
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

/** *** תוספת (בקשה מפורשת - מסמך העדכון, סעיפים 2-6: "לא להציג
 *  autocomplete גלוי - matching מאחורי הקלעים"): תוצאה סופית אחת
 *  מ-/api/tripadd/match-place, לא רשימת הצעות לבחירה. matched=false
 *  עדיין תקין (יש קואורדינטות, פשוט לא נמצאה ישות Google תואמת). */
interface MatchResult {
  matched: boolean;
  googlePlaceId: string | null;
  address: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  ratingCount: number | null;
  confidence: number | null;
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
  // *** תוספת (בקשה מפורשת - מסמך העדכון, סעיפים 2-6): מיקום GPS
  // תמיד ראשון - זה קובע איפה המקום ימוקם על המפה, בלי קשר לתוצאת
  // ה-matching מול גוגל (שתי דאגות נפרדות: "איפה זה" ו-"מה זה זוהה
  // כ-" - ר' matchGooglePlaceByLocation.ts).
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentPositionSafe()
      .then((pos) => setCoords(pos))
      .catch((err) => setLocationError(err instanceof Error ? err.message : "לא הצלחנו לאתר את המיקום שלך"))
      .finally(() => setLocating(false));
  }, []);

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
  // *** תוספת (בקשה מפורשת - "שיתוף ב-place's, מסומן כברירת מחדל"):
  // true כברירת מחדל - המשתמש מוריד את הסימון אם הוא לא רוצה לשתף.
  const [shareToPlaces, setShareToPlaces] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [mergedIntoExisting, setMergedIntoExisting] = useState(false);

  /**
   * *** תוספת (בקשה מפורשת - מסמך העדכון, סעיף 2: "לא להציג
   * autocomplete בזמן שהמשתמש מקליד... matching מאחורי הקלעים") +
   * סעיף 30 (ביצועים - "לא לבצע Google request על כל תו"): נקרא פעם
   * אחת, כשהמשתמש לוחץ "אתר מיקום" - לא ב-onChange של השדה. אם יש
   * GPS - שולח name+coords ל-matching (עם locationBias, לא טקסט
   * חופשי - סעיף 4). אם אין GPS - נופל לכתובת ידנית (geocoding בלבד,
   * בלי ניסיון התאמה לישות גוגל - סעיף 6, אפשרות A).
   */
  async function handleFindLocation() {
    if (!nameQuery.trim() && !coords) {
      setMatchError("הזן שם מקום");
      return;
    }
    if (!coords && !manualAddress.trim()) {
      setMatchError("לא זיהינו את מיקומך - הזן כתובת כדי שנוכל למקם את המקום על המפה");
      return;
    }
    setMatching(true);
    setMatchError(null);
    try {
      const body = coords
        ? { name: nameQuery.trim(), latitude: coords.lat, longitude: coords.lng }
        : { address: manualAddress.trim() };
      const res = await fetch("/api/tripadd/match-place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMatchError(data.error ?? "שגיאה באיתור המקום");
        return;
      }
      setMatchResult(data);
    } catch {
      setMatchError("שגיאת רשת באיתור המקום");
    } finally {
      setMatching(false);
    }
  }

  /**
   * *** שינוי (מסמך העדכון, סעיף 6 - "אם Google לא מצליח לזהות, עדיין
   * אפשר לשמור עם כתובת/מיקום"): קודם הייתה כאן דרישה מפורשת של
   * המשתמש - "אם לא נבחר מקום מגוגל, אי אפשר לשמור" - זה **מבוטל
   * במפורש** לפי המסמך החדש: matchResult (גם matched=false, כל עוד
   * יש קואורדינטות) מספיק כדי להמשיך. הסיווג עצמו (AI) עובד עם השם
   * + הכתובת אם יש (matched) או רק השם אם אין (unmatched) - לא תלוי
   * יותר ב-placeId ספציפי.
   */
  async function handleSelectCategory(c: TripAddCategory) {
    setCategory(c);
    setSubcategory(null);
    setSubcategoryGroup(null);
    setClassifyError(null);
    if (!matchResult) return;

    setClassifying(true);
    try {
      const res = await fetch("/api/tripadd/classify-subcategory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameQuery.trim(), address: matchResult.address ?? undefined, category: c }),
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
    const finalName = nameQuery.trim();
    if (!finalName) {
      setError("הזן שם מקום");
      return;
    }
    if (!matchResult) {
      setError("יש לאתר מיקום למקום (כפתור \"אתר מיקום\" למעלה) לפני השמירה");
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
          address: matchResult.address ?? (manualAddress.trim() || undefined),
          latitude: matchResult.latitude,
          longitude: matchResult.longitude,
          description: description.trim() || undefined,
          subcategory: subcategory ?? undefined,
          googlePlaceId: matchResult.googlePlaceId ?? undefined,
          // *** תוספת (מסמך העדכון, סעיפים 5,7,29 - נקודת התאמה ירוקה +
          // מעקב Admin עתידי): matched -> "matched" (עוד לא מאומת ע"י
          // Admin, ר' migration 0087), unmatched -> "unmatched".
          googleMatchStatus: matchResult.matched ? "matched" : "unmatched",
          googleMatchConfidence: matchResult.confidence ?? undefined,
          mediaIds: media.map((m) => m.id),
          shareToPlaces,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "שגיאה בשמירת המקום");
      }
      // *** תוספת (בקשה מפורשת - "לאחד מקומות כפולים לפי google_place_id"):
      // אם המקום כבר קיים אצלנו, השרת לא יצר "מקום" שני - הוא רק הוסיף/
      // עדכן את הביקורת של המשתמש הזה על המקום הקיים. ההודעה כאן משקפת
      // את זה, כדי שלא יראה כאילו "נוצר" מקום חדש בטעות.
      const responseData = await res.json().catch(() => ({}));
      setMergedIntoExisting(Boolean(responseData?.mergedIntoExisting));
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
            <h3 className="text-[15px] font-bold text-ink">{mergedIntoExisting ? "הביקורת שלך נשמרה!" : "המקום נשמר!"}</h3>
            <p className="max-w-xs text-[13px] text-ink-secondary">
              {mergedIntoExisting
                ? "המקום הזה כבר קיים אצלנו - הדירוג והתיאור שלך נוספו לביקורות שלו."
                : "הפרטים שלך נשמרו וממתינים לבדיקת המערכת. ברגע שהמקום יאושר, הוא ייכנס למאגר ויופיע במפה ובעמוד שלו."}
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

              {/* 2. שם המקום - *** תיקון (בקשה מפורשת - מסמך העדכון,
                  סעיף 2: "לא להציג autocomplete גלוי - שדה טקסט רגיל
                  שבו המשתמש כותב את שם המקום בעצמו"): בלי שום רשימת
                  הצעות מתחת לשדה, אף פעם. */}
              <label className="mb-1 mt-4 block text-[12.5px] font-semibold text-ink-secondary">שם המקום</label>
              <input
                value={nameQuery}
                onChange={(e) => {
                  setNameQuery(e.target.value);
                  setMatchResult(null);
                  setMatchError(null);
                }}
                placeholder="לדוגמה: קפה השעון"
                className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />

              {/* *** תוספת (סעיף 6, אפשרות A): שדה כתובת ידני - מוצג רק
                  אם GPS לא הצליח (locationError) ועדיין אין תוצאת
                  מיקום. אם GPS הצליח, אין צורך לבקש כתובת בכלל - יש
                  כבר קואורדינטות אמיתיות מהמכשיר. */}
              {locationError && !matchResult && (
                <div className="mt-2">
                  <p className="mb-1 text-[12px] text-ink-secondary">{locationError} - הזן כתובת במקום:</p>
                  <input
                    value={manualAddress}
                    onChange={(e) => {
                      setManualAddress(e.target.value);
                      setMatchResult(null);
                    }}
                    placeholder="כתובת המקום"
                    className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
              )}

              {!matchResult && (
                <button
                  type="button"
                  onClick={handleFindLocation}
                  disabled={locating || matching || !nameQuery.trim() || (!coords && !manualAddress.trim())}
                  className="mt-2 w-full rounded-pill py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
                >
                  {locating ? "מאתר את מיקומך..." : matching ? "מאתר את המקום..." : "אתר מיקום"}
                </button>
              )}

              {matchError && <p className="mt-2 text-[12px] text-red-500">{matchError}</p>}

              {/* *** תוצאת ה-matching - בדיוק שורה אחת, בלי רשימת
                  הצעות. נקודה ירוקה (סעיף 5) רק אם matched=true - לא
                  מוצגת בכלל אם matched=false, כדי לא "להמציא" אימות
                  שלא קיים (סעיף 26). */}
              {matchResult && (
                <div className="mt-2 flex items-center gap-2 rounded-card bg-bg-secondary px-3 py-2.5">
                  <span style={{ color: "var(--color-primary-start)" }}>📍</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-ink">
                      {matchResult.matched && (
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ background: "var(--color-category-green)" }}
                          title="זוהתה התאמה אוטומטית ל-Google"
                        />
                      )}
                      {nameQuery.trim()}
                    </span>
                    {matchResult.address && <span className="block truncate text-[11.5px] text-ink-secondary">{matchResult.address}</span>}
                    {!matchResult.matched && (
                      <span className="block text-[11px] text-ink-secondary">לא זוהתה התאמה ב-Google - נשמר לפי המיקום/כתובת שסיפקת</span>
                    )}
                  </span>
                  <button type="button" onClick={() => setMatchResult(null)} className="shrink-0 text-[11.5px] text-ink-secondary underline">
                    שנה
                  </button>
                </div>
              )}

              {/* 3. סוג - אותן 6 קטגוריות בדיוק כמו שורת "סוגי הטיול" בבית.
                  *** שינוי (מסמך העדכון, סעיף 6): נעול עד שיש matchResult
                  (מיקום כלשהו - matched או לא), לא עד שיש דווקא Google
                  match מאומת. */}
              <label className="mb-1.5 mt-4 block text-[12.5px] font-semibold text-ink-secondary">סוג</label>
              <div className={`flex flex-wrap gap-2 ${!matchResult ? "pointer-events-none opacity-40" : ""}`}>
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

              {/* 6. שיתוף ב-place's - בקשה מפורשת: מסומן כברירת מחדל,
                  עם לוגו place's כדי שיהיה ברור בדיוק לאן זה משותף. */}
              <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-[14px] border border-ink-secondary/15 p-3">
                <input
                  type="checkbox"
                  checked={shareToPlaces}
                  onChange={(e) => setShareToPlaces(e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-accent"
                />
                <span className="flex flex-1 items-center gap-1.5 text-[13px] font-medium text-ink">
                  שיתוף ב-
                  <Image src="/images/places-logo.png" alt="place's" width={62} height={20} className="object-contain" />
                </span>
              </label>

              {error && <p className="mt-3 text-[12.5px] text-red-500">{error}</p>}
            </div>

            {/* 7. שמירה - פוטר קבוע, כולל safe-area, תמיד גלוי */}
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
