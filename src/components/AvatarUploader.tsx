"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { uploadAvatar, updateProfile, removeAvatar } from "@/services/profile/profileService";
import { getAvatarUrl } from "@/constants/avatar";
import { useAuth } from "@/hooks/useAuth";

interface AvatarUploaderProps {
  userId: string;
  initialUrl?: string | null;
  onUploaded?: (url: string) => void;
  /** נקרא כשהתמונה נמחקה וחזרנו לברירת המחדל. */
  onRemoved?: () => void;
  /** נקרא כשבוטלה בחירת קובץ שעדיין לא נשמרה (מצב deferSave) - כדי
   *  שההורה ינקה את ה-File הממתין שלו, שאם לא כן עלול להיות מועלה
   *  בטעות בלחיצת "שמירה" הבאה. */
  onFileCleared?: () => void;
  /** קוטר העיגול בפיקסלים. ברירת מחדל 112. מתעלמים ממנו במצב fluid. */
  size?: number;
  /** במצב fluid העיגול ממלא את ההורה (ההורה קובע את הגודל) - למשל כשמצמידים אותו לחור בתמונת hero. */
  fluid?: boolean;
  /** מסגרת כחולה סביב העיגול. מכבים כשהמסגרת כבר מצוירת בתמונת הרקע. */
  bordered?: boolean;
  /** true = לא מעלים מיד בבחירת קובץ - רק מציגים תצוגה מקדימה מקומית
   *  ומעבירים את הקובץ להורה דרך onFileSelected, שאחראי להעלות אותו
   *  בעצמו (למשל יחד עם שמירת שדות אחרים בטופס, בלחיצה אחת על "שמירה"). */
  deferSave?: boolean;
  /** נקרא במצב deferSave כשנבחר קובץ - מעביר את ה-File הגולמי להורה. */
  onFileSelected?: (file: File) => void;
}

/** עיגול תמונת פרופיל עם כפתור להעלאת תמונה מהמכשיר, וכפתור מחיקה
 *  שמחזיר לתמונת ברירת המחדל הגנרית כשיש תמונה מותאמת אישית.
 *
 *  סנכרון בין עמודים: אחרי העלאה/מחיקה מרעננים גם את ה-profile הגלובלי
 *  (useAuth().refreshProfile) - כך שכל מקום אחר באפליקציה שמציג את תמונת
 *  הפרופיל של המשתמש המחובר (header, stories וכו') מתעדכן בלי רענון דף,
 *  בנוסף לעדכון המקומי של הרכיב עצמו. */
export function AvatarUploader({
  userId,
  initialUrl,
  onUploaded,
  onRemoved,
  onFileCleared,
  size = 112,
  fluid = false,
  bordered = true,
  deferSave = false,
  onFileSelected,
}: AvatarUploaderProps) {
  const { refreshProfile } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (deferSave) {
      // לא מעלים כלום כרגע - רק תצוגה מקדימה מקומית, וההורה שומר את
      // הקובץ בעצמו (בדרך כלל יחד עם שאר הטופס, בלחיצה על "שמירה").
      setError(null);
      setAvatarUrl(URL.createObjectURL(file));
      onFileSelected?.(file);
      e.target.value = "";
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const url = await uploadAvatar(userId, file);
      await updateProfile(userId, { avatar_url: url });
      setAvatarUrl(url);
      onUploaded?.(url);
      await refreshProfile();
    } catch {
      setError("העלאת התמונה נכשלה, נסו שוב");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleRemove() {
    if (uploading) return;

    // אם המשתמש רק בחר קובץ חדש אבל עוד לא נשמר (preview מקומי במצב
    // deferSave) - "מחיקה" כאן פשוט מבטלת את הבחירה, בלי לגעת בתמונה
    // האמיתית שכבר שמורה בשרת.
    const isPendingPreview = avatarUrl?.startsWith("blob:");
    if (isPendingPreview) {
      setAvatarUrl(initialUrl && !initialUrl.startsWith("blob:") ? initialUrl : null);
      onFileCleared?.();
      return;
    }

    if (!avatarUrl) return;

    setUploading(true);
    setError(null);
    try {
      await removeAvatar(userId);
      setAvatarUrl(null);
      onRemoved?.();
      await refreshProfile();
    } catch {
      setError("מחיקת התמונה נכשלה, נסו שוב");
    } finally {
      setUploading(false);
    }
  }

  // true רק כשיש תמונה מותאמת אישית בפועל (לא ברירת המחדל) - רק אז
  // מציגים את כפתור המחיקה.
  const hasCustomAvatar = Boolean(avatarUrl && avatarUrl.trim().length > 0);

  const avatarCircle = (
    <div
      className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-bg ${
        bordered ? "border-4 border-[var(--color-primary-start)] shadow-soft" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getAvatarUrl(avatarUrl)} alt="תמונת פרופיל" className="h-full w-full object-cover" />
    </div>
  );

  const fileInput = (
    <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
  );

  if (fluid) {
    return (
      <div className="h-full w-full">
        <div className="relative h-full w-full">
          {avatarCircle}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-[7%] end-[7%] flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white shadow-soft disabled:opacity-60"
            aria-label="העלאת תמונה"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>

          {hasCustomAvatar && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="absolute top-[7%] end-[7%] flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-soft disabled:opacity-60"
              aria-label="מחיקת תמונה"
              title="מחיקת תמונה"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}

          {fileInput}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex flex-col items-center gap-2.5">
      <div className="relative" style={{ width: size, height: size }}>
        {avatarCircle}
      </div>

      {/* כפתורי הפעולה יושבים לגמרי מתחת לעיגול, לא מוצמדים/חופפים לו. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white shadow-soft disabled:opacity-60"
          aria-label="העלאת תמונה"
          title="העלאת תמונה"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        {hasCustomAvatar && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-secondary/20 bg-white text-ink-secondary shadow-soft disabled:opacity-60"
            aria-label="מחיקת תמונה - חזרה לתמונת ברירת המחדל"
            title="מחיקת תמונה"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7" />
            </svg>
          </button>
        )}
      </div>

      {fileInput}

      {uploading && <p className="text-center text-xs text-ink-secondary">{"רק רגע..."}</p>}
      {error && <p className="text-center text-xs text-danger">{error}</p>}
    </div>
  );
}
