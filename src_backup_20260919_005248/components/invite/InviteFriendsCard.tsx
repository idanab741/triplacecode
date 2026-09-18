"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { buildInviteUrl } from "@/services/invite/inviteService";

interface InviteFriendsCardProps {
  /** קישור הזמנה חיצוני, לשימוש בבדיקות/תצוגה בלבד. כברירת מחדל
   *  הכרטיס בונה את הקישור האישי האמיתי מ-invite_code של המשתמש המחובר
   *  (ר' migration 0061 + inviteService.ts) - לעולם לא קישור כללי לעמוד הבית. */
  inviteUrl?: string;
  /** אם מועבר - הכרטיס מוצג בתוך פופאפ (InviteFriendsModal) ומקבל כפתור סגירה צף. */
  onClose?: () => void;
}

const SHARE_TITLE = "Triplace";
const SHARE_TEXT = "היי! 👋 מצאתי את TRIPLACE ובא לי להזמין אותך להצטרף אליי - בואו נתכנן את הטיול הבא שלנו יחד ✈️🧳";

/**
 * כרטיסיית "הזמן חברים".
 *
 * *** בכוונה לא כולל: טריפים/נקודות/הטבות/הנחות, "קבל X טריפים", מדרגות
 * תגמול, מונה חברים שהוזמנו, Progress bar, טאבים/ניווט, או קוד הזמנה
 * שמופיע באופן בולט. מערכת תגמול תתווסף בעתיד בנפרד - זה פיצ'ר חברתי
 * טבעי בלבד: "בוא איתי", לא "הורד את האפליקציה".
 *
 * *** תיקון (התמונה הלא נכונה הוצגה בכרטיס): hero-tripmatch.png הוא
 * צילום מסך של ממשק ה-Swipe/TripMatch (שני טלפונים, X אדום, לב כחול) -
 * מתאים להקשר של Tripmatch, לא להזמנת חברים. הכרטיס עכשיו משתמש בנכס
 * הוויזואלי הייעודי שסופק לפיצ'ר הזה - hero-invite-friends.jpg (קמע
 * triplace עם מזוודה מול נוף סנטוריני, public/images) - לא איור SVG
 * מאולתר ולא תמונת HERO ממקור לא קשור.
 *
 * *** תיקון (הפיכת הפיצ'ר לאמיתי): הקישור כבר לא origin/ כללי - הוא
 * נבנה מ-profile.invite_code האישי והייחודי של המשתמש המחובר. כל עוד
 * הפרופיל עדיין נטען, כל פעולות השיתוף מושבתות (ולא נופלות לקישור דמה) -
 * ר' requireUrl/isReady למטה. הלינק מוביל בפועל ל-/join/<code>, שבו
 * TRIPLACE מזהה את מקור ההזמנה ושומרת את הקשר בין המזמין למוזמן
 * (redeem_invite, נקרא מ-/auth אחרי הרשמה/התחברות מוצלחת).
 */
export function InviteFriendsCard({ inviteUrl, onClose }: InviteFriendsCardProps) {
  const { user, profile, profileLoading } = useAuth();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const resolvedUrl = inviteUrl ?? (profile?.invite_code ? buildInviteUrl(profile.invite_code) : null);
  const isReady = Boolean(resolvedUrl);
  const isLoading = !inviteUrl && Boolean(user) && profileLoading;

  /** לעולם לא מחזירה קישור דמה/כללי - אם הקוד האישי עוד לא נטען, הפעולות
   *  שמשתמשות בה פשוט לא מתבצעות (הכפתורים גם מושבתים ויזואלית - ר' JSX). */
  function requireUrl(): string | null {
    return resolvedUrl;
  }

  /**
   * *** תיקון (באג אמיתי - "פותח את וואטסאפ אבל לא את מסך בחירת איש
   * קשר"): window.open(url, "_blank") היה הבעיה. בנייד (ובמיוחד בתוך
   * WebView מוטמע), פתיחת wa.me בחלון/טאב חדש גורמת למערכת ההפעלה
   * לפעמים "לזרוק" למשתמש רק את האפליקציה עצמה (cold-launch) בלי למסור
   * את ה-deep link המלא (עם טקסט ההודעה) שמוביל למסך בחירת איש הקשר/
   * שליחה. ניווט ישיר באותו טאב (location.href) הוא הדרך התקינה
   * והנפוצה למימוש כפתורי wa.me - ה-handoff ל-app מתבצע כניווט אמיתי,
   * לא כפתיחת חלון, ולכן מגיע ל-WhatsApp עם כל הפרמטרים ופותח את מסך
   * הבחירה/שליחה בפועל.
   */
  /**
   * *** תיקון (באג אמיתי - "מגיע לעמוד הראשי, לא לרשימת אנשי קשר"):
   * wa.me/?text=... הוא לא הכתובת הנכונה למקרה הזה. wa.me מתועד ע"י
   * וואטסאפ כ-"Click to Chat" עם *מספר טלפון ידוע* בנתיב עצמו
   * (wa.me/<number>?text=...) - כשאין מספר בנתיב, אין יעד מוגדר וההתנהגות
   * לא עקבית (לרוב פשוט פותח את האפליקציה/הצ'אטים, בלי לפתוח את מסך
   * בחירת איש הקשר). הכתובת המתועדת של וואטסאפ בדיוק למקרה של "שתף
   * טקסט הזה, תן למשתמש לבחור למי לשלוח" (בלי מספר ידוע מראש) היא
   * api.whatsapp.com/send - זו הכתובת שבאמת פותחת את מסך בחירת איש הקשר.
   */
  async function handleWhatsApp() {
    const url = requireUrl();
    if (!url) return;
    const text = encodeURIComponent(`${SHARE_TEXT}\n${url}`);
    window.location.href = `https://api.whatsapp.com/send?text=${text}`;
  }

  /**
   * *** תיקון (באג אמיתי): הגרסה הקודמת "בלעה" בשקט כל כשל של
   * navigator.clipboard והציגה "הועתק!" גם כשכלום לא הועתק בפועל -
   * זה קורה למשל בכל דף שרץ על http (לא https) ולא ב-localhost עצמו,
   * למשל בדיקה ב-IP מקומי מהנייד. עכשיו יש שרשרת fallback אמיתית:
   * Clipboard API -> execCommand הישן (עובד גם ב-http) -> אם גם זה
   * נכשל, prompt עם הקישור כדי שהמשתמש עדיין יוכל להעתיק ידנית - לא
   * מוצג "הועתק" מזויף בשום מקרה.
   */
  async function handleCopyLink() {
    const url = requireUrl();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1800);
      return;
    } catch {
      // ה-Clipboard API לא זמין/נכשל (למשל http לא מאובטח) - ננסה fallback
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!ok) throw new Error("execCommand copy failed");
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1800);
      return;
    } catch {
      // גם ה-fallback נכשל - נציג את הקישור ישירות למשתמש להעתקה ידנית
    }

    setCopyState("error");
    window.prompt("העתיקו את הקישור:", url);
    setTimeout(() => setCopyState("idle"), 1800);
  }

  async function handleShare() {
    const url = requireUrl();
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
      } catch {
        // המשתמש ביטל את השיתוף - לא שגיאה אמיתית
      }
    } else {
      await handleCopyLink();
    }
  }

  return (
    <div className="overflow-hidden rounded-card bg-white shadow-soft">
      {/* אזור ויזואלי מרכזי - תמונת ה-HERO האמיתית של triplace */}
      <div className="relative h-44 w-full overflow-hidden">
        <Image src="/images/hero-invite-friends.jpg" alt="קמע triplace עם מזוודה" fill priority className="object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 45%)" }}
        />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft backdrop-blur-sm"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="px-6 pb-6 pt-1 text-center">
        <h2 className="text-xl font-bold text-ink">הזמן חברים</h2>
        <p className="mx-auto mt-1.5 max-w-[280px] text-sm leading-relaxed text-ink-secondary">
          שתפו את Triplace עם החברים שלכם והזמינו אותם להצטרף לחוויית הטיולים.
        </p>

        {/* אזור שיתוף - שלוש פעולות בלבד, בלי היררכיה מתחרה עם הכותרת/ויזואל.
            מושבתות כל עוד הקישור האישי לא נטען - לעולם לא שולחות קישור דמה. */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={!isReady}
            aria-label="שיתוף בוואטסאפ"
            className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-bg-secondary py-3.5 transition active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-soft">
              <WhatsAppIcon />
            </span>
            <span className="text-xs font-semibold text-ink-secondary">וואטסאפ</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            disabled={!isReady}
            aria-label="העתקת קישור הזמנה"
            className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-bg-secondary py-3.5 transition active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-soft">
              {copyState === "copied" ? <CheckIcon /> : <LinkIcon />}
            </span>
            <span className="text-xs font-semibold text-ink-secondary">
              {copyState === "copied" ? "הועתק!" : copyState === "error" ? "העתיקו ידנית" : "העתק קישור"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            disabled={!isReady}
            aria-label="שיתוף"
            className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-bg-secondary py-3.5 transition active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-soft">
              <ShareIcon />
            </span>
            <span className="text-xs font-semibold text-ink-secondary">שיתוף</span>
          </button>
        </div>

        {/* "קישור ההזמנה שלך" - אזור קטן ונקי (דרישה #9), עם הקישור האמיתי
            ופעולת העתקה משלו. לא מוצג בכלל אם המשתמש לא מחובר. */}
        {user && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-bg-secondary px-4 py-3 text-start">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-ink-secondary">קישור ההזמנה שלך</p>
              {isLoading ? (
                <div className="mt-1 h-4 w-32 animate-pulse rounded-full bg-white/70" />
              ) : (
                <p className="mt-0.5 truncate text-sm font-medium text-ink" dir="ltr">
                  {resolvedUrl ?? "—"}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!isReady}
              aria-label="העתקת קישור ההזמנה שלך"
              className="flex shrink-0 items-center gap-1.5 rounded-pill bg-white px-3 py-2 text-xs font-semibold text-ink shadow-soft transition active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
            >
              {copyState === "copied" ? <CheckIcon /> : <LinkIcon />}
              {copyState === "copied" ? "הועתק!" : "העתק"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12.02 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.44 1.33 4.93L2 22l5.24-1.37a9.9 9.9 0 0 0 4.78 1.22h.01c5.5 0 9.96-4.46 9.96-9.96S17.52 2 12.02 2Z"
        fill="#25D366"
      />
      <path
        d="M17.1 14.36c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.13-.42-2.16-1.34-.8-.71-1.34-1.6-1.5-1.87-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.48-.84-2.03-.22-.53-.44-.46-.61-.47-.16-.01-.34-.01-.52-.01-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.28 0 1.34.98 2.64 1.12 2.82.14.18 1.93 2.95 4.68 4.14.65.28 1.16.45 1.56.58.66.21 1.25.18 1.72.11.53-.08 1.6-.65 1.82-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32Z"
        fill="#ffffff"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-end)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3ec28f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-end)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
