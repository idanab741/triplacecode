"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { BottomSheet, Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { uploadMultipleSocialMedia, type UploadedMedia } from "@/services/social/mediaUploadService";

interface CreateReviewSheetProps {
  placeId: string;
  placeName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

/** כתיבת ביקורת אמיתית: דירוג 1-5 כוכבים + טקסט + עד 4 תמונות/וידאו -
 *  נשמר ב-place_reviews הקיים ומופיע ב-Feed (סעיף 37-39, בקשה #9). */
export function CreateReviewSheet({ placeId, placeName, onClose, onSubmitted }: CreateReviewSheetProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [media, setMedia] = useState<(UploadedMedia & { previewUrl: string })[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilesSelected(files: FileList | null) {
    if (!files || !user) return;
    const selected = Array.from(files).slice(0, 4 - media.length);
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

  async function handleSubmit() {
    if (rating === 0) {
      setError("בחר דירוג לפני שמפרסמים");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/social/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, rating, comment: comment.trim(), mediaIds: media.map((m) => m.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "שגיאה בפרסום הביקורת");
      }
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="max-h-[85vh] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-6 pt-4">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink-secondary/20" />
        <h2 className="mb-1 text-[17px] font-bold text-ink">כתיבת ביקורת</h2>
        <p className="mb-4 truncate text-[13px] text-ink-secondary">{placeName}</p>

        <div className="mb-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} כוכבים`}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill={star <= rating ? "var(--color-places-purple)" : "none"} stroke="var(--color-places-purple)" strokeWidth="1.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="איך היה? מה כדאי לדעת?"
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
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
          <button
            type="button"
            disabled={uploading || media.length >= 4}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--color-places-purple)", color: "var(--color-places-purple)" }}
          >
            📷 {uploading ? "מעלה..." : "הוסף תמונה/וידאו"}
          </button>
        </div>

        {error && <p className="mt-3 text-[12.5px] text-red-500">{error}</p>}

        <div className="mt-5">
          <Button
            fullWidth
            disabled={submitting || uploading}
            onClick={handleSubmit}
            style={{ background: "var(--color-places-purple)", backgroundImage: "none" }}
          >
            {submitting ? "מפרסם..." : "פרסם ביקורת"}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
