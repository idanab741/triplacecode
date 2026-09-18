"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface SaveTripIconButtonProps {
  sessionId: string | null;
  /** קלאס אופציונלי לאייקון עצמו (למשל WHITE_ICON_FILTER מ-TripHeroHeader.tsx,
   *  כשהכפתור יושב על בר שקוף מעל תמונת HERO) - ברירת מחדל ריקה שומרת
   *  על ההתנהגות הקיימת (אייקון בצבעים המקוריים) בכל שימוש אחר. */
  iconClassName?: string;
}

/** כפתור שמירה/הסרה מהשמורים לטיול. בשמירה (הפיכה לכחול) הטיול נכנס
 *  ללשונית "שמורים" והמשתמש חוזר מיד לעמוד הבית. בביטול שמירה נשארים בעמוד. */
export function SaveTripIconButton({ sessionId, iconClassName = "" }: SaveTripIconButtonProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/trip-builder/sessions/${sessionId}/save`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSaved(data.saved === true);
      })
      .catch(() => {});
  }, [sessionId]);

  async function handleClick() {
    if (!sessionId || loading) return;
    const nextSaved = !saved;
    setLoading(true);
    setSaved(nextSaved); // אופטימי - מרגיש מיידי
    try {
      const response = await fetch(`/api/trip-builder/sessions/${sessionId}/save`, {
        method: nextSaved ? "POST" : "DELETE",
      });
      if (!response.ok) throw new Error();
      if (nextSaved) router.push("/home");
    } catch {
      setSaved(!nextSaved); // rollback אם נכשל
      alert("שמירת הטיול נכשלה, נסו שוב");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label={saved ? "הסרה מהשמורים" : "שמור טיול"}
      className="flex h-10 w-10 items-center justify-center rounded-full text-ink disabled:opacity-60"
    >
      <Image src={saved ? "/icons/save-active.png" : "/icons/save.png"} alt="" width={23} height={23} className={iconClassName} />
    </button>
  );
}