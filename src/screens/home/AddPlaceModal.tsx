"use client";

import { PopupOverlay } from "@/components/ui";

interface AddPlaceModalProps {
  onClose: () => void;
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/**
 * *** שלב 1 בלבד (הפרומפט - "את תהליך הוספת המקום עצמו נבנה בפרומפט
 * נפרד. בשלב הזה יש להכין את הכפתור ואת פתיחת ה-Modal בלבד, ללא בניית
 * הטופס המלא"): כרגע רק מארז ה-Modal עצמו, בלי טופס. נפתח כ-Modal/
 * Popup אמיתי מעל המפה (PopupOverlay הקיים - fixed inset-0 עם backdrop
 * כהה+blur, אותו מארז שכבר משמש את LocationPromptModal/
 * InviteFriendsModal) - במפורש **לא** Bottom Sheet, לא גלילה, ולא
 * פתיחה בתוך עמוד הבית עצמו.
 */
export function AddPlaceModal({ onClose }: AddPlaceModalProps) {
  return (
    <PopupOverlay onClose={onClose}>
      <div className="relative overflow-hidden rounded-card bg-white p-6 text-center shadow-soft">
        <button
          type="button"
          onClick={onClose}
          aria-label="סגירה"
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-bg-secondary text-ink"
        >
          <CloseIcon />
        </button>

        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          <PlusIcon />
        </div>

        <h2 className="mt-4 text-lg font-bold text-ink">הוספת מקום חדש</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
          טופס הוספת המקום יתווסף כאן בשלב הבא. בשלב הנוכחי הוכן רק הכפתור ופתיחת החלון.
        </p>
      </div>
    </PopupOverlay>
  );
}
