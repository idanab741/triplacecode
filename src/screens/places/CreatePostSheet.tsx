"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { BottomSheet, Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { uploadMultipleSocialMedia, type UploadedMedia } from "@/services/social/mediaUploadService";
import type { PostVisibility } from "@/services/social/types";

interface CreatePostSheetProps {
  onClose: () => void;
  onSubmit: (text: string, visibility: PostVisibility, mediaIds: string[]) => Promise<void>;
}

const VISIBILITY_OPTIONS: { id: PostVisibility; label: string }[] = [
  { id: "public", label: "ציבורי" },
  { id: "followers", label: "עוקבים" },
  { id: "friends", label: "חברים" },
  { id: "private", label: "פרטי" },
];

const MAX_FILES = 4;

/** יצירת Post - טקסט + עד 4 תמונות/סרטונים אמיתיים (Storage upload +
 *  media_assets, לא placeholder). מענה ישיר לבקשה #9 - "למה אי אפשר
 *  להוסיף תמונות וסרטונים". */
export function CreatePostSheet({ onClose, onSubmit }: CreatePostSheetProps) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [media, setMedia] = useState<(UploadedMedia & { previewUrl: string })[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilesSelected(files: FileList | null) {
    if (!files || !user) return;
    const remaining = MAX_FILES - media.length;
    const selected = Array.from(files).slice(0, remaining);
    if (selected.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const uploaded = await uploadMultipleSocialMedia(supabase, user.id, selected);
      setMedia((prev) => [...prev, ...uploaded.map((m, i) => ({ ...m, previewUrl: URL.createObjectURL(selected[i]) }))]);
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

  async function handleSubmit() {
    if (!text.trim() && media.length === 0) {
      setError("כתוב משהו או הוסף תמונה/וידאו לפני שמפרסמים");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(
        text.trim(),
        visibility,
        media.map((m) => m.id)
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בפרסום הפוסט");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="max-h-[85vh] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-6 pt-4">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink-secondary/20" />
        <h2 className="mb-4 text-[17px] font-bold text-ink">יצירת פוסט</h2>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="מה קורה בטיול?"
          rows={4}
          className="w-full resize-none rounded-card border border-ink-secondary/15 p-3 text-[14px] text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
        />

        {media.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {media.map((m) => (
              <div key={m.id} className="relative aspect-square overflow-hidden rounded-card bg-bg-secondary">
                {m.type === "video" ? (
                  <video src={m.previewUrl} className="h-full w-full object-cover" muted />
                ) : (
                  <Image src={m.previewUrl} alt="" fill className="object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(m.id)}
                  aria-label="הסר"
                  className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
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
            className="flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--color-places-purple)", color: "var(--color-places-purple)" }}
          >
            📷 {uploading ? "מעלה..." : "הוסף תמונה/וידאו"}
          </button>
          <span className="text-[11px] text-ink-secondary">{media.length}/{MAX_FILES}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {VISIBILITY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setVisibility(option.id)}
              className="rounded-pill px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
              style={
                visibility === option.id
                  ? { background: "var(--color-places-purple)", color: "white" }
                  : { background: "var(--color-bg-secondary, #f2f2f5)", color: "var(--color-ink-secondary, #8a94a6)" }
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-[12.5px] text-red-500">{error}</p>}

        <div className="mt-5">
          <Button
            fullWidth
            disabled={submitting || uploading}
            onClick={handleSubmit}
            style={{ background: "var(--color-places-purple)", backgroundImage: "none" }}
          >
            {submitting ? "מפרסם..." : "פרסם"}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
