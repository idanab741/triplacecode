"use client";

import { useState } from "react";
import { InviteTravelScene } from "./InviteTravelScene";

interface InviteFriendsCardProps {
  /** קישור ההזמנה. אם לא מועבר, נגזר מכתובת האתר הנוכחית (origin/). */
  inviteUrl?: string;
}

const SHARE_TITLE = "Triplace";
const SHARE_TEXT = "בואו לגלות את הטיול הבא שלנו יחד ב-Triplace 🧳✈️";

/**
 * כרטיסיית "הזמן חברים".
 *
 * *** בכוונה לא כולל: טריפים/נקודות/הטבות/הנחות, "קבל X טריפים", מדרגות
 * תגמול, מונה חברים שהוזמנו, Progress bar, טאבים/ניווט, או קוד הזמנה
 * שמופיע באופן בולט. מערכת תגמול תתווסף בעתיד בנפרד - זה פיצ'ר חברתי
 * טבעי בלבד: "בוא איתי", לא "הורד את האפליקציה".
 */
export function InviteFriendsCard({ inviteUrl }: InviteFriendsCardProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  function resolveUrl() {
    if (inviteUrl) return inviteUrl;
    if (typeof window !== "undefined") return window.location.origin;
    return "https://tripmatch.app";
  }

  async function handleWhatsApp() {
    const url = resolveUrl();
    const text = encodeURIComponent(`${SHARE_TEXT}\n${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  async function handleCopyLink() {
    const url = resolveUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // אם ה-Clipboard API חסום - עדיין נראה משוב חיובי למשתמש, הקישור בכל זאת זמין ידנית
    }
    setCopyState("copied");
    setTimeout(() => setCopyState("idle"), 1800);
  }

  async function handleShare() {
    const url = resolveUrl();
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
      {/* אזור ויזואלי מרכזי - הדמות הרשמית בסצנת טיול, בלי לגלוש לעומס */}
      <div className="bg-[linear-gradient(180deg,#eaf3ff_0%,#f9fbff_100%)] px-6 pt-6">
        <div className="mx-auto max-w-[280px]">
          <InviteTravelScene />
        </div>
      </div>

      <div className="px-6 pb-6 pt-4 text-center">
        <h2 className="text-xl font-bold text-ink">הזמן חברים</h2>
        <p className="mx-auto mt-1.5 max-w-[280px] text-sm leading-relaxed text-ink-secondary">
          שתפו את Triplace עם החברים שלכם והזמינו אותם להצטרף לחוויית הטיולים.
        </p>

        {/* אזור שיתוף - שלוש פעולות בלבד, בלי היררכיה מתחרה עם הכותרת/ויזואל */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleWhatsApp}
            aria-label="שיתוף בוואטסאפ"
            className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-bg-secondary py-3.5 transition active:scale-[0.96]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-soft">
              <WhatsAppIcon />
            </span>
            <span className="text-xs font-semibold text-ink-secondary">וואטסאפ</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            aria-label="העתקת קישור הזמנה"
            className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-bg-secondary py-3.5 transition active:scale-[0.96]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-soft">
              {copyState === "copied" ? <CheckIcon /> : <LinkIcon />}
            </span>
            <span className="text-xs font-semibold text-ink-secondary">
              {copyState === "copied" ? "הועתק!" : "העתק קישור"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            aria-label="שיתוף"
            className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-bg-secondary py-3.5 transition active:scale-[0.96]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-soft">
              <ShareIcon />
            </span>
            <span className="text-xs font-semibold text-ink-secondary">שיתוף</span>
          </button>
        </div>
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
