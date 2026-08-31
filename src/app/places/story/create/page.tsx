"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackButton } from "@/components/ui";

const BACKGROUNDS = [
  "linear-gradient(135deg, var(--color-places-purple), var(--color-primary-end))",
  "linear-gradient(135deg, #ff9a8b, #ff6a88)",
  "linear-gradient(135deg, #43cea2, #185a9d)",
  "linear-gradient(135deg, #232526, #414345)",
];

/** יצירת Story טקסטואלי - חלק ראשון של Create Story (סעיף 6, 89).
 *  Story עם מדיה (תמונה/וידאו) מתחבר לכאן ברגע שיש upload UI משותף. */
export default function CreateStoryPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [bgIndex, setBgIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    if (!text.trim()) {
      setError("כתוב משהו לסטורי");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/social/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), visibility: "public" }),
      });
      if (!res.ok) throw new Error("שגיאה בפרסום הסטורי");
      router.replace("/places");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: BACKGROUNDS[bgIndex] }}>
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="rounded-full bg-white/90 p-0.5">
          <BackButton onBack={() => router.back()} />
        </span>
        <button
          type="button"
          onClick={handlePublish}
          disabled={submitting}
          className="rounded-pill bg-white px-4 py-2 text-[13px] font-bold text-ink disabled:opacity-50"
        >
          {submitting ? "מפרסם..." : "פרסם"}
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-8">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="מה קורה?"
          rows={4}
          className="w-full resize-none bg-transparent text-center text-[24px] font-bold text-white placeholder:text-white/70 focus:outline-none"
        />
      </div>

      {error && <p className="px-6 pb-2 text-center text-[12.5px] text-white">{error}</p>}

      <div className="flex justify-center gap-3 pb-8">
        {BACKGROUNDS.map((bg, i) => (
          <button
            key={bg}
            type="button"
            onClick={() => setBgIndex(i)}
            aria-label={`רקע ${i + 1}`}
            className="h-9 w-9 rounded-full border-2"
            style={{ background: bg, borderColor: i === bgIndex ? "white" : "transparent" }}
          />
        ))}
      </div>
    </div>
  );
}
