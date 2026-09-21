"use client";

import { useRef, useState } from "react";
import { BottomSheet } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { uploadSocialMedia } from "@/services/social/mediaUploadService";

interface CoverPickerSheetProps {
  /** ה-Cover הנוכחי. null = אוטומטי. */
  coverUrl: string | null;
  /** תמונות קיימות (של הפריטים/התחנות) לבחירה כקאבר. */
  imageUrls: string[];
  /** טקסט האפשרות "אוטומטי" (למשל "קאבר אוטומטי"). */
  autoLabel?: string;
  /** כותרת ה-Sheet (ברירת מחדל "בחירת קאבר" - לשימוש בטיולים). CollectionForm מעביר
   *  "בחירת תמונת האוסף", כי "קאבר" אינה המילה הנכונה עבור אוספים. */
  heading?: string;
  onSelect: (url: string | null) => void;
  onClose: () => void;
}

/** בחירת Cover - משותף לאוספים ולטיולים: אוטומטי / אחת מהתמונות הקיימות / העלאה מהמכשיר
 *  (אותה מערכת מדיה קיימת: uploadSocialMedia). לא נוצרת שום תמונה חדשה. */
export function CoverPickerSheet({ coverUrl, imageUrls, autoLabel = "קאבר אוטומטי", heading = "בחירת קאבר", onSelect, onClose }: CoverPickerSheetProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file || !user) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadSocialMedia(createClient(), user.id, file);
      onSelect(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאת התמונה");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="max-h-[75vh] overflow-y-auto px-5 pb-4">
        <h2 className="mb-3 text-[17px] font-bold text-ink">{heading}</h2>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="mb-2 flex w-full items-center justify-between rounded-card px-3 py-3 text-start text-[14px] font-semibold text-ink hover:bg-bg-secondary"
        >
          {autoLabel}
          {coverUrl === null && <span style={{ color: "var(--color-places-purple)" }}>✓</span>}
        </button>

        {imageUrls.length > 0 && (
          <>
            <p className="mb-2 mt-3 text-[12.5px] font-semibold text-ink-secondary">מתוך התמונות שנוספו</p>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {[...new Set(imageUrls)].map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => onSelect(url)}
                  className={`relative aspect-square overflow-hidden rounded-card ring-2 ${coverUrl === url ? "ring-[var(--color-places-purple)]" : "ring-transparent"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-pill border py-2.5 text-[13.5px] font-bold disabled:opacity-50"
          style={{ borderColor: "var(--color-places-purple)", color: "var(--color-places-purple)" }}
        >
          {uploading ? "מעלה..." : "העלאת תמונה מהמכשיר"}
        </button>
        {error && <p className="mt-2 text-center text-[12.5px] text-red-500">{error}</p>}
      </div>
    </BottomSheet>
  );
}
