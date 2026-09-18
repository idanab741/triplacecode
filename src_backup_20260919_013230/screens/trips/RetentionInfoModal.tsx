"use client";

import { PopupCard, PopupOverlay } from "@/components/ui";

interface RetentionInfoModalProps {
  onClose: () => void;
  /** מספר הימים שנשארו לבחירה הזמנית (הלא-שמורה) הכי קרובה למחיקה,
   *  לפי getDaysRemainingBeforeRemoval - null אם עדיין אין בכלל
   *  בחירות זמניות ברשימה (למשל עמוד ריק, או שהכל כבר שמור). כשיש
   *  ערך - הוא מוצג בפועל במקום להסתפק בטקסט כללי, לפי הבקשה המפורשת
   *  "אין להציג את 14 יום כטקסט סטטי אם ניתן לחשב מידע דינמי".
   */
  nearestExpiringDays: number | null;
}

/**
 * *** Popup חדש (בקשה מפורשת - "עמוד הבחירות שלי - שינויים", סעיף
 * UX): מסביר את מנגנון השמירה הזמנית של "בחירה" (טיול/מסלול/תוצאת
 * trippy AI) - בלי להפחיד ("עמוד יימחק"), ובלי להטעות (זה לא העמוד
 * שנמחק - רק תוכן זמני לא-שמור בתוכו). נבנה על אותו מארז עיצובי
 * בדיוק כמו שאר ה-Popups הממותגים (PopupCard/PopupOverlay -
 * LocationPromptModal/TokenBalancePill) - אנימציית Fade+Scale עדינה
 * כבר מובנית שם, לא נוצרה כאן מחדש.
 *
 * *** תוספת (בקשה מפורשת - "לא להעמיס בטקסט", "המשתמש צריך להבין תוך
 * כמה שניות"): שתי משפטים בלבד + כפתור סגירה אחד. אין רשימה/טבלה של
 * כללים.
 */
export function RetentionInfoModal({ onClose, nearestExpiringDays }: RetentionInfoModalProps) {
  return (
    <PopupOverlay onClose={onClose}>
      <PopupCard onClose={onClose} imageSrc="/images/tripy.png" imageAlt="Trippy">
        <div>
          <h2 className="text-lg font-bold text-ink">יצרת משהו? הוא כאן, זמנית</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
            תוצאה חדשה נשמרת כאן לזמן מוגבל. אהבתם אותה? לחצו &quot;שמור&quot; והיא נשארת איתכם לצמיתות בלשונית &quot;שמורים&quot;.
          </p>
        </div>

        {/* *** תצוגה דינמית - ר' הערה על nearestExpiringDays למעלה. לא
            מוצג בכלל אם אין עדיין אף בחירה זמנית ברשימה (nearestExpiringDays
            null) - אין טעם להזכיר ספירה כשאין למה להתייחס. */}
        {nearestExpiringDays != null && (
          <div className="flex items-center gap-3 rounded-2xl border border-ink-secondary/10 bg-bg-secondary/70 px-4 py-3.5 text-right">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              {nearestExpiringDays}
            </span>
            <span className="min-w-0 flex-1 text-sm text-ink">
              {nearestExpiringDays === 0
                ? "הבחירה הכי ותיקה שלכם עוד לא שמורה - זו ההזדמנות האחרונה."
                : `הבחירה הכי ותיקה שטרם שמרתם תישאר כאן עוד ${nearestExpiringDays} ${nearestExpiringDays === 1 ? "יום" : "ימים"}.`}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-pill px-6 py-3 text-sm font-semibold text-white shadow-soft"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          הבנתי, תודה!
        </button>
      </PopupCard>
    </PopupOverlay>
  );
}
