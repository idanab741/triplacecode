"use client";

import { useState } from "react";

interface AddToCalendarButtonProps {
  sessionId: string | null;
  date: string;
}

export function AddToCalendarButton({ sessionId, date }: AddToCalendarButtonProps) {
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!sessionId || saving || added) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/trip-builder/sessions/${sessionId}/calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      if (!response.ok) throw new Error();
      setAdded(true);
    } catch {
      setError("ההוספה ליומן נכשלה, נסו שוב");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={saving || added}
        className="w-full rounded-pill py-2 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
      >
        {saving ? "שומר..." : added ? "✓ נוסף ליומן" : "הוספה ליומן"}
      </button>
      {error && <p className="text-center text-xs text-danger">{error}</p>}
    </div>
  );
}