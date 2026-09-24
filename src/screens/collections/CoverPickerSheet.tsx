"use client";

import { useRef, useState } from "react";
import { BottomSheet } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { uploadSocialMedia } from "@/services/social/mediaUploadService";
import { ActionRow, CREATE_BLUE, CheckIcon, ErrorBox, ImageIcon, SparkleIcon } from "@/screens/create/CreateUi";

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

  const autoSelected = coverUrl === null;

  return (
    <BottomSheet onClose={onClose}>
      <div className="max-h-[75vh] overflow-y-auto px-5 pb-4">
        <h2 className="mb-3 text-[20px] font-bold tracking-tight text-ink">{heading}</h2>

        {/* אוטומטי - כרטיס בחירה עם סימון ברור */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={autoSelected}
          className={`flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-start transition active:scale-[0.99] ${
            autoSelected ? "bg-[#0A6DFE]/[0.08] ring-2 ring-[#0A6DFE]" : "bg-[#F7F8FA]"
          }`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(10,109,254,0.1)", color: CREATE_BLUE }}>
            <SparkleIcon />
          </span>
          <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{autoLabel}</span>
          {autoSelected && (
            <span style={{ color: CREATE_BLUE }}>
              <CheckIcon />
            </span>
          )}
        </button>

        {imageUrls.length > 0 && (
          <>
            <p className="mb-2 mt-5 text-[14px] font-semibold text-ink">מתוך התמונות שנוספו</p>
            <div className="grid grid-cols-3 gap-1.5">
              {[...new Set(imageUrls)].map((url) => {
                const selected = coverUrl === url;
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onSelect(url)}
                    aria-pressed={selected}
                    className={`relative aspect-square overflow-hidden rounded-[14px] transition active:scale-95 ${selected ? "ring-[3px] ring-[#0A6DFE] ring-offset-2" : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {selected && (
                      <span className="absolute end-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: CREATE_BLUE }}>
                        <CheckIcon size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        <div className="mt-5">
          <ActionRow
            icon={<ImageIcon />}
            title={uploading ? "מעלה..." : "העלאת תמונה מהמכשיר"}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          />
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
    </BottomSheet>
  );
}
