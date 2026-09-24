"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/services/auth/authService";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { MainBottomNav } from "@/components/MainBottomNav";
import { InviteFriendsModal } from "@/components/invite/InviteFriendsModal";
import { TripsBalanceBadge } from "@/screens/profile/TripsBalanceBadge";
import { getAvatarUrl } from "@/constants/avatar";
import { Skeleton } from "@/components/ui";

/**
 * *** שדרוג עיצובי (בקשה מפורשת - "נעצב את עמוד ההגדרות בהתאם לעיצוב החדש"): אותו קו כמו עמוד האטרקציה
 * ועריכת הפרופיל - רקע לבן, טקסט שחור חד, כותרות קטע מודגשות, ושורות בסגנון פייסבוק (אייקון בעיגול
 * אפור, כותרת, תת-כותרת וחץ) במקום כרטיסים עם צל. הלוגיקה (ניווט, התנתקות, מחיקת חשבון) לא השתנתה.
 */
const INK = { "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties;

const ip = { width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const MenuIcons = {
  sliders: (
    <svg {...ip}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  ),
  user: (
    <svg {...ip}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  bookmark: (
    <svg {...ip}>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.5L5.5 21V4.5a1 1 0 0 1 1-1z" />
    </svg>
  ),
  calendar: (
    <svg {...ip}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  ),
  invite: (
    <svg {...ip}>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
    </svg>
  ),
  route: (
    <svg {...ip}>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
    </svg>
  ),
  headset: (
    <svg {...ip}>
      <path d="M4 17v-5a8 8 0 0 1 16 0v5" />
      <path d="M20 18a2 2 0 0 1-2 2h-1a1.5 1.5 0 0 1-1.5-1.5V15a1.5 1.5 0 0 1 1.5-1.5h3V18zM4 18a2 2 0 0 0 2 2h1a1.5 1.5 0 0 0 1.5-1.5V15A1.5 1.5 0 0 0 7 13.5H4V18z" />
    </svg>
  ),
  shield: (
    <svg {...ip}>
      <path d="M12 3 5 6v5.5c0 4.3 3 7.8 7 9.5 4-1.7 7-5.2 7-9.5V6l-7-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  logout: (
    <svg {...ip}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
    </svg>
  ),
};

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-ink-secondary">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

/** שורה בתפריט: אייקון בעיגול אפור, כותרת (ותת-כותרת), חץ. disabled = "בקרוב". */
function MenuRow({
  icon,
  title,
  subtitle,
  onClick,
  soon = false,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  soon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={soon}
      className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3.5 rounded-xl px-2 py-2.5 text-start transition-colors active:bg-black/[0.04] disabled:active:bg-transparent"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F1F2F5] text-ink ${soon ? "opacity-50" : ""}`}>{icon}</span>
      <span className={`min-w-0 flex-1 ${soon ? "opacity-50" : ""}`}>
        <span className="block text-[15.5px] font-semibold leading-snug text-ink">{title}</span>
        {subtitle && <span className="block truncate text-[13px] text-ink-secondary">{subtitle}</span>}
      </span>
      {soon ? (
        <span className="shrink-0 rounded-full bg-[#F1F2F5] px-2.5 py-1 text-[12px] font-semibold text-ink-secondary">בקרוב</span>
      ) : (
        <Chevron />
      )}
    </button>
  );
}

function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-5 pt-6">
      <h2 className="mb-1.5 text-[17px] font-bold text-ink">{title}</h2>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

export default function ProfilePage() {
  const { loading, profile, profileLoading } = useAuth();
  const router = useRouter();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // "הזמן חברים" נפתח כבועה (InviteFriendsModal) מעל המסך הנוכחי - לא
  // ניווט לעמוד /invite נפרד (ר' בקשה מפורשת: "בועה נפתחת, לא עמוד נפרד").
  const [showInviteModal, setShowInviteModal] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  async function handleDeleteAccount() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/profile/delete-account", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? `מחיקת החשבון נכשלה (סטטוס ${response.status})`);

      await signOut();
      router.push("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "מחיקת החשבון נכשלה";
      setDeleteError(message);
      alert(`שגיאה במחיקת החשבון:\n\n${message}`);
      setDeleting(false);
    }
  }

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-white pb-28">
        <div className="mx-auto flex max-w-xl items-center gap-3.5 px-5 pt-24">
          <Skeleton className="h-[72px] w-[72px] rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-28" style={INK}>
      {/* בלי קאבר בעמוד הזה (בקשה קודמת): בר triplace עם חזרה, ומיד אחריו התמונה, השם והרשימה. */}
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => router.back()} />
      <div className="mx-auto max-w-xl">
        {/* תמונת פרופיל מימין, השם + הטריפים והעיר משמאלה (בקשות קודמות). */}
        <div className="flex items-center gap-3.5 px-5 pb-2 pt-4">
          <span className="block h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full bg-[#E9ECF1] shadow-[0_2px_10px_rgba(15,20,25,0.12)] ring-[3px] ring-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAvatarUrl(profile?.avatar_url)} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1 text-start">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 truncate text-[22px] font-bold leading-tight tracking-tight text-ink">{profile?.full_name || "המשתמש שלי"}</h1>
              <TripsBalanceBadge />
            </div>
            {profile?.city && <p className="mt-0.5 truncate text-[14px] text-ink-secondary">{profile.city}</p>}
          </div>
        </div>

        <MenuSection title="החשבון שלי">
          <MenuRow icon={MenuIcons.sliders} title="התאמות אישיות" subtitle="סוגי הטיול שאתם אוהבים" onClick={() => router.push("/preferences?returnTo=/profile")} />
          <MenuRow icon={MenuIcons.user} title="עריכת פרופיל" subtitle="שם, תמונה, אימייל וסיסמה" onClick={() => router.push("/places/profile/edit")} />
          {/* "הבחירות שלי" מוביל ל-/trips (שם עדכני בלבד - בקשה קודמת). */}
          <MenuRow icon={MenuIcons.bookmark} title="הבחירות שלי" subtitle="מקומות וטיולים ששמרתם" onClick={() => router.push("/trips")} />
          <MenuRow icon={MenuIcons.calendar} title="היומן שלי" onClick={() => router.push("/calendar")} />
        </MenuSection>

        <MenuSection title="חברים">
          {/* "הזמן חברים" נפתח כבועה מעל המסך (בקשה קודמת - "בועה נפתחת, לא עמוד נפרד"). */}
          <MenuRow icon={MenuIcons.invite} title="הזמנת חברים" subtitle="שתפו ותזכו בהטבות" onClick={() => setShowInviteModal(true)} />
          <MenuRow icon={MenuIcons.route} title="שיתוף מסלול בין חברים" soon />
        </MenuSection>

        <MenuSection title="עזרה ומידע">
          <MenuRow icon={MenuIcons.headset} title="שירות לקוחות" subtitle="יש לכם שאלה? כתבו לנו" onClick={() => router.push("/support")} />
          <MenuRow icon={MenuIcons.shield} title="מדיניות פרטיות ותנאי שימוש" onClick={() => router.push("/terms")} />
        </MenuSection>

        <div className="flex flex-col gap-2 px-5 pt-8">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#EFF1F4] text-[15.5px] font-semibold text-ink transition active:scale-[0.98]"
          >
            {MenuIcons.logout}
            התנתקות
          </button>

          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="h-11 w-full rounded-xl text-[14.5px] font-medium text-danger transition active:bg-danger/[0.06]"
            >
              מחיקת החשבון
            </button>
          ) : (
            <div className="mt-2 rounded-2xl bg-[#FDECEC] p-4" role="alert">
              <p className="text-[15.5px] font-bold text-[#C4282D]">למחוק את החשבון?</p>
              <p className="mt-1 text-[14px] leading-snug text-[#8E2A2D]">הפעולה בלתי הפיכה. כל הנתונים שלכם יימחקו לצמיתות.</p>
              {deleteError && <p className="mt-2 text-[13px] font-medium text-[#C4282D]">{deleteError}</p>}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="h-12 flex-1 rounded-xl bg-white text-[15.5px] font-semibold text-ink transition active:scale-[0.98] disabled:opacity-60"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="h-12 flex-1 rounded-xl bg-danger text-[15.5px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
                >
                  {deleting ? "מוחקים..." : "כן, למחוק"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <MainBottomNav active="profile" />

      {showInviteModal && <InviteFriendsModal onClose={() => setShowInviteModal(false)} />}
    </div>
  );
}
