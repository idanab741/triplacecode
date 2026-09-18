"use client";

import { useEffect, useState } from "react";
import { PopupCard, PopupOverlay } from "@/components/ui";
import { TOKEN_COSTS } from "@/constants/tokenCosts";

interface BalanceState {
  balance: number;
  allowance: number;
  cycleStart: string;
}

// *** תיקון (בקשה מפורשת - "לסדר את הנראות של הכפתור"): סף ה"אדום"
// (20) נבחר בכוונה להיות שווה בדיוק לעלות הפעולה הזולה ביותר במערכת
// (TOKEN_COSTS.tripmatch_like) - זו הנקודה שבה יתרה נמוכה הופכת
// לבעייתית בפועל (אולי כבר אי אפשר לבצע אפילו לייק אחד ב-TripMatch).
const RED_THRESHOLD = 20;
const YELLOW_THRESHOLD = 50;

type Level = "healthy" | "low" | "critical";

function getLevel(balance: number): Level {
  if (balance <= RED_THRESHOLD) return "critical";
  if (balance < YELLOW_THRESHOLD) return "low";
  return "healthy";
}

const LEVEL_STYLES: Record<Level, string> = {
  healthy: "bg-[var(--color-primary-start)]/10 text-[var(--color-primary-start)]",
  low: "bg-amber-100 text-amber-700",
  critical: "bg-danger/10 text-danger",
};

/** תאריך האיפוס הבא - תמיד ה-1 לחודש הקלנדרי שאחרי cycleStart (ר' migration 0063). */
function nextResetDate(cycleStart: string): Date {
  const start = new Date(cycleStart);
  return new Date(start.getFullYear(), start.getMonth() + 1, 1);
}

/** כמה ימים נשארו עד האיפוס הבא - לכרטיס "מתחדשים בעוד X ימים" (בקשה מפורשת). */
function daysUntilReset(cycleStart: string): number {
  const diffMs = nextResetDate(cycleStart).getTime() - Date.now();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/** אייקון מסלול (route) - קווי, בסגנון האייקונים הקיימים באפליקציה (PinIcon וכו'). */
function RouteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="6" r="2.2" />
      <circle cx="19" cy="18" r="2.2" />
      <path d="M5 8.2v3.3a3 3 0 0 0 3 3h7.5a3 3 0 0 1 3 3v.3" strokeDasharray="1 4" />
    </svg>
  );
}

/** אייקון לב (TripMatch like) - קווי, אותו סגנון בדיוק. */
function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.6-9.8-9.4C.7 7.6 2.3 4 6 4c2 0 3.6 1.1 6 3.6C14.4 5.1 16 4 18 4c3.7 0 5.3 3.6 3.8 7.1-2.3 4.8-9.8 9.4-9.8 9.4z" />
    </svg>
  );
}

/**
 * תוכן הפופאפ הרגיל - Trippy מסביר מה זה טריפים. לא הוזז/שונה (בקשת
 * המשתמש התמקדה במצב "נגמרו הטריפים" בלבד) - רק עבר להשתמש במארז
 * המשותף PopupCard במקום קוד כפול.
 */
function TokensExplainerContent({ allowance }: { allowance: number }) {
  return (
    <>
      <div>
        <h2 className="text-lg font-bold text-ink">מה זה טריפים?</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
          טריפים הם המטבע של TRIPLACE 🎟️
          <br />
          משתמשים בהם כדי להפעיל פעולות מיוחדות באפליקציה.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-ink-secondary/10 bg-bg-secondary/70 px-3 py-4">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-white"
            style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
          >
            <RouteIcon />
          </span>
          <span className="text-2xl font-extrabold leading-none text-ink">{TOKEN_COSTS.trippy_ai_generation}</span>
          <span className="text-[11px] font-medium leading-tight text-ink-secondary">
            בניית מסלול טיול
            <br />
            עם Trippy AI
          </span>
        </div>

        <div className="flex flex-col items-center gap-2 rounded-2xl border border-ink-secondary/10 bg-bg-secondary/70 px-3 py-4">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-white"
            style={{ background: "linear-gradient(135deg, #ff8fb3, var(--color-category-pink))" }}
          >
            <HeartIcon />
          </span>
          <span className="text-2xl font-extrabold leading-none text-ink">{TOKEN_COSTS.tripmatch_like}</span>
          <span className="text-[11px] font-medium leading-tight text-ink-secondary">
            לייק
            <br />
            ב-TripMatch
          </span>
        </div>
      </div>
    </>
  );
}

/**
 * *** תוכן הפופאפ "נגמרו הטריפים" (בקשה מפורשת - עיצוב מחדש מלא):
 * קמע עצוב ייעודי (trippy-tokens-empty.png), כרטיס "מתחדשים בעוד X
 * ימים" דינמי (מחושב מ-cycleStart הקיים - אין כאן שינוי במנגנון
 * החישוב או במועד החידוש עצמו, רק תצוגה), וכפתור "מנוי" שהוא Preview
 * בלבד (Badge "בקרוב", ללא onClick/ניווט - כדי שלא יראה כאילו המנוי
 * כבר קיים).
 */
function RanOutContent({ cycleStart, onClose }: { cycleStart: string; onClose: () => void }) {
  const days = daysUntilReset(cycleStart);
  const daysLabel = days === 1 ? "יום" : `${days} ימים`;

  return (
    <>
      <div>
        <h2 className="text-lg font-bold text-ink">נגמרו לך הטריפים</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
          השתמשת בכל הטריפים שלך החודש.
          <br />
          הם יחזרו אליך ב-1 לחודש.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-ink-secondary/10 bg-bg-secondary/70 px-4 py-3.5 text-right">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-soft">🎟️</span>
        <span className="text-[13.5px] font-semibold leading-snug text-ink">
          הטריפים שלך מתחדשים בעוד {daysLabel}
        </span>
      </div>

      <p className="text-sm text-ink-secondary">עד אז, ממשיכים לטייל ולגלות ב-TRIPLACE ✈️</p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-pill px-6 py-3 text-sm font-semibold text-white shadow-soft"
          style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
        >
          המשך לגלות
        </button>

        {/* *** "מנוי" - Preview בלבד (בקשה מפורשת): לא ניתן ללחיצה, בלי
            onClick/ניווט, כדי שלא יראה כאילו יש כרגע מנוי אמיתי. */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="relative w-full cursor-not-allowed rounded-pill border border-ink-secondary/15 bg-bg-secondary/60 px-6 py-3 text-sm font-semibold text-ink-secondary"
        >
          מנוי
          <span
            className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-pill px-2 py-0.5 text-[10px] font-bold text-white shadow-soft"
            style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
          >
            בקרוב
          </span>
        </button>
      </div>
    </>
  );
}

/**
 * תצוגת יתרת "טריפים" - מתחת לשם המשתמש בפרופיל (דרישה מפורשת #13).
 * נטענת תמיד מהשרת (לא state גלובלי/localStorage - מקור אמת יחיד, ר'
 * services/tokens/tokenService.ts) בכל טעינה/מעבר מחדש לעמוד, כדי
 * שהיתרה תמיד תשקף שימוש שקרה במסכים אחרים (Trippy AI/TripMatch).
 * כשל בטעינה לא מציג באנר שגיאה - זה widget משני, לא חוסם את שאר הפרופיל.
 *
 * *** תיקון (בקשה מפורשת - "לסדר נראות + פופאפ הסבר + פופאפ נגמרו
 * הטריפים"): הצבע של הפס נגזר מרמת היתרה (בריאה/נמוכה/קריטית), ולחיצה
 * עליו פותחת פופאפ הסבר. כשהיתרה 0 בפועל, אותו פופאפ עובר למצב "נגמרו
 * הטריפים".
 *
 * *** עדכון עיצוב (בקשה מפורשת - "עיצוב מחדש מקצועי, Premium, לא
 * Modal גנרי, אותה מערכת עיצוב כמו פופאפ שינוי המיקום"): המארז
 * המשותף (כרטיס, X, באנר, עיגול קמע, אנימציות) עבר ל-PopupCard/
 * PopupOverlay (components/ui) - אותו קובץ בדיוק שבו משתמש גם
 * LocationPromptModal.tsx, כדי ששני ה-Popups ירגישו כמו חלק מאותה
 * מערכת. מצב "נגמרו הטריפים" קיבל תוכן ייעודי חדש (RanOutContent) עם
 * קמע עצוב (trippy-tokens-empty.png) - שאר הלוגיקה (חישוב היתרה, מועד
 * האיפוס, TOKEN_COSTS) לא השתנתה, רק התצוגה.
 */
export function TokenBalancePill() {
  const [state, setState] = useState<BalanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tokens/balance")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "טעינת היתרה נכשלה");
        if (!cancelled) setState({ balance: data.balance, allowance: data.allowance, cycleStart: data.cycleStart });
      })
      .catch(() => {
        // widget משני - כשל בטעינה לא אמור לשבש את שאר עמוד הפרופיל
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="h-6 w-28 animate-pulse rounded-pill bg-bg-secondary" />;
  }
  if (!state) return null;

  const level = getLevel(state.balance);
  const ranOut = state.balance <= 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setInfoOpen(true)}
        className={`inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-semibold ${LEVEL_STYLES[level]}`}
      >
        ✦ {state.balance} / {state.allowance} טריפים
      </button>

      {infoOpen && (
        <PopupOverlay onClose={() => setInfoOpen(false)}>
          <PopupCard
            onClose={() => setInfoOpen(false)}
            imageSrc={ranOut ? "/images/trippy-tokens-empty.png" : "/images/trippy-tokens-popup.png"}
            imageAlt="Trippy"
          >
            {ranOut ? (
              <RanOutContent cycleStart={state.cycleStart} onClose={() => setInfoOpen(false)} />
            ) : (
              <TokensExplainerContent allowance={state.allowance} />
            )}
          </PopupCard>
        </PopupOverlay>
      )}
    </>
  );
}
