"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui";
import { SOCIAL_LABELS, normalizeSocialHandle, type SocialPlatform } from "@/services/social/socialLinks";
import { SocialIcon } from "./SocialIcons";

interface SocialLinkSheetProps {
  platform: SocialPlatform;
  /** ה-handle הנוכחי (בלי @), אם קיים. */
  current: string | null;
  onClose: () => void;
  /** שומר: handle מנורמל, או null להסרה. זורק Error עם הודעה להצגה. */
  onSave: (handle: string | null) => Promise<void>;
}

/** הוספה / עריכה / הסרה של קישור אינסטגרם או טיקטוק בפרופיל שלי. מקבל handle, @handle או קישור מלא. */
export function SocialLinkSheet({ platform, current, onClose, onSave }: SocialLinkSheetProps) {
  const [value, setValue] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = SOCIAL_LABELS[platform];

  async function submit(next: string | null) {
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
      setSaving(false);
    }
  }

  function handleSave() {
    try {
      submit(normalizeSocialHandle(platform, value));
    } catch (err) {
      setError(err instanceof Error ? err.message : "שם משתמש לא תקין");
    }
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-5 pb-4">
        <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold text-ink">
          <SocialIcon platform={platform} size={20} />
          {label.name}
        </h2>
        <div className="flex items-center gap-2 rounded-card border border-ink-secondary/20 px-4 py-3">
          <span className="text-[15px] text-ink-secondary">@</span>
          <input
            autoFocus
            dir="ltr"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect="off"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink focus:outline-none"
          />
        </div>
        <p className="mt-1.5 text-[12px] text-ink-secondary">אפשר להדביק שם משתמש או קישור לפרופיל.</p>
        {error && <p className="mt-2 text-[12.5px] text-red-500">{error}</p>}

        <button
          type="button"
          disabled={saving || value.trim().length === 0}
          onClick={handleSave}
          className="mt-4 w-full rounded-pill py-3 text-[14.5px] font-bold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(150deg, #22B8FD, #007CFE)" }}
        >
          {saving ? "שומרים..." : "שמירה"}
        </button>
        {current && (
          <button type="button" disabled={saving} onClick={() => submit(null)} className="mt-2 w-full py-2.5 text-[13.5px] font-bold text-red-500 disabled:opacity-50">
            הסרה
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
