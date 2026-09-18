"use client";

import { useState, type FormEvent } from "react";
import { PasswordInput, PopupCard, PopupOverlay } from "@/components/ui";

const PLACES_ACCESS_PASSWORD = "0548315055";

interface PlacesPasswordModalProps {
  onClose: () => void;
  /** נקרא רק אחרי שהסיסמה שהוזנה תואמת - אין כאן שום ניווט עצמאי. */
  onSuccess: () => void;
}

/**
 * *** Popup חדש (בקשה מפורשת - "כשלוחצים עליו יהיה צריך להזין סיסמה"):
 * שער סיסמה זמני לכניסה ל-place's, נפתח בלחיצה על שקופית ה-places
 * בקרוסלת "עוד בשבילך ב-TRIPLACE" (DiscoverCard) במקום ניווט ישיר.
 * הסיסמה לא נשמרת בשום מקום (לא localStorage ולא state חיצוני) - בכל
 * לחיצה על השקופית נפתח הפופאפ הזה מחדש ודורש הקלדה מחדש.
 *
 * אותו מארז עיצובי בדיוק כמו שאר ה-Popups הממותגים (PopupCard/
 * PopupOverlay), עם תמונת lock-hero.png הקיימת (כבר בשימוש במסך
 * register-required) במקום קמע Trippy רגיל - מתאים תמטית לשער נעילה.
 */
export function PlacesPasswordModal({ onClose, onSuccess }: PlacesPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.trim() === PLACES_ACCESS_PASSWORD) {
      onSuccess();
      return;
    }
    setError(true);
  }

  return (
    <PopupOverlay onClose={onClose}>
      <PopupCard onClose={onClose} imageSrc="/images/lock-hero.png" imageAlt="">
        <div>
          <h2 className="text-lg font-bold text-ink">
            place<span className="opacity-60">&apos;</span>s בגישה מוגבלת
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
            יש להזין סיסמה כדי להיכנס
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <PasswordInput
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(false);
            }}
            placeholder="סיסמה"
            autoFocus
          />

          {error && (
            <p className="text-sm font-medium text-red-500">סיסמה שגויה, נסו שוב</p>
          )}

          <button
            type="submit"
            className="w-full rounded-pill px-6 py-3 text-sm font-semibold text-white shadow-soft"
            style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }}
          >
            כניסה
          </button>
        </form>
      </PopupCard>
    </PopupOverlay>
  );
}
