"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AddToCalendarButtonProps {
  sessionId: string | null;
  date: string;
}

/** מכניס את הטיול ליומן לפי התאריך מהצ'אט, ומחזיר מיד לעמוד הבית בהצלחה.
 *  אם הטיול כבר ביומן - מציג אפשרות להסיר אותו (בלי לנווט הביתה). */
export function AddToCalendarButton({ sessionId, date }: AddToCalendarButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [inCalendar, setInCalendar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/trip-builder/sessions/${sessionId}/calendar`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setInCalendar(data.inCalendar === true);
      })
      .catch(() => {});
  }, [sessionId]);

  async function handleAdd() {
    if (!sessionId || loading || inCalendar) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/trip-builder/sessions/${sessionId}/calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      if (!response.ok) throw new Error();
      setInCalendar(true);
      router.push("/home");
    } catch {
      setError("ההוספה ליומן נכשלה, נסו שוב");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!sessionId || loading) return;
    setLoading(true);
    setError(null);
    setInCalendar(false); // עדכון אופטימי
    try {
      const response = await fetch(`/api/trip-builder/sessions/${sessionId}/calendar`, { method: "DELETE" });
      if (!response.ok) throw new Error();
    } catch {
      setInCalendar(true); // rollback אם נכשל
      setError("ההסרה מהיומן נכשלה, נסו שוב");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {inCalendar ? (
        <button
          type="button"
          onClick={handleRemove}
          disabled={loading}
          className="w-full rounded-pill border-2 border-[var(--color-primary-start)] py-2 text-sm font-semibold text-[var(--color-primary-start)] disabled:opacity-60"
        >
          {loading ? "מסיר..." : "✓ ביומן - הסרה מהיומן"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleAdd}
          disabled={loading}
          className="w-full rounded-pill py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          {loading ? "שומר..." : "הוספה ליומן"}
        </button>
      )}
      {error && <p className="text-center text-xs text-danger">{error}</p>}
    </div>
  );
}
