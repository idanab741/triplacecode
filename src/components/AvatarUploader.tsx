"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { uploadAvatar, updateProfile } from "@/services/profile/profileService";

interface AvatarUploaderProps {
  userId: string;
  initialUrl?: string | null;
  onUploaded?: (url: string) => void;
}

/** עיגול תמונת פרופיל עם כפתור פלוס להעלאת תמונה מהמכשיר. */
export function AvatarUploader({ userId, initialUrl, onUploaded }: AvatarUploaderProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const url = await uploadAvatar(userId, file);
      await updateProfile(userId, { avatar_url: url });
      setAvatarUrl(url);
      onUploaded?.(url);
    } catch {
      setError("העלאת התמונה נכשלה, נסו שוב");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mx-auto flex flex-col items-center">
      <div className="relative h-28 w-28">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-[var(--color-primary-start)] bg-bg-secondary">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="תמונת פרופיל" className="h-full w-full object-cover" />
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-secondary)" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          )}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 end-0 flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white shadow-soft disabled:opacity-60"
          aria-label="העלאת תמונה"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploading && <p className="mt-2 text-xs text-ink-secondary">מעלה...</p>}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
