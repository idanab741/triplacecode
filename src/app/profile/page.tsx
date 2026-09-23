"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/services/auth/authService";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { MainBottomNav } from "@/components/MainBottomNav";
import { InviteFriendsModal } from "@/components/invite/InviteFriendsModal";
import { TripsBalanceBadge } from "@/screens/profile/TripsBalanceBadge";
import { getAvatarUrl } from "@/constants/avatar";
import { Button, Skeleton } from "@/components/ui";

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

  function ChevronLeft() {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-ink-secondary"
      >
        <path d="M15 6l-6 6 6 6" />
      </svg>
    );
  }

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-bg pb-28">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 pt-10">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      {/* *** בקשה מפורשת - "בלי תמונה ובלי קאבר בעמוד הזה ספציפית": עמוד התפריט (שלוש הפסים בפרופיל) - בלי תמונת
          הפרופיל ובלי הקאבר. במקומם - בר triplace עם חזרה, ומיד אחריו השם והרשימה. כרטיס "פרטים אישיים" (שם/אימייל/סיסמה)
          הוסר: אותם שדות בדיוק נמצאים ב"עריכת פרופיל". */}
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => router.back()} />
      <div className="mx-auto max-w-xl">
        <div className="overflow-hidden rounded-b-[50px] bg-white">
          <div className="flex flex-col gap-4 px-5 pb-5 pt-5">
            {/* *** בקשה מפורשת - "עיגול של תמונת הפרופיל עם השם ליד משמאל": העיגול מימין (התחלה ב-RTL), השם והעיר משמאלו. */}
            <div className="flex items-center gap-3.5">
              <span className="block h-[76px] w-[76px] shrink-0 overflow-hidden rounded-full border-[3px] border-white bg-bg-secondary shadow-soft ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getAvatarUrl(profile?.avatar_url)} alt="" className="h-full w-full object-cover" />
              </span>
              <div className="min-w-0 flex-1 text-start">
                {/* *** בקשה מפורשת - "שהטריפים שלי יהיו ליד השם" (ושורת "במיוחד להרצה" הוסרה) */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <h1 className="min-w-0 truncate text-xl font-bold text-ink">{profile?.full_name || "המשתמש שלי"}</h1>
                  <TripsBalanceBadge />
                </div>
                <p className="truncate text-sm text-ink-secondary">{profile?.city || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* *** בקשה מפורשת - "רווח אחיד לכולם!!!!": כל השורות (הכירו, התאמות, עריכת פרופיל, הבחירות, היומן, ...) ברשימה אחת
            עם gap-3 (12px) קבוע. קודם: gap-2 בתוך בלוק לבן + 32px בין הבלוק לרשימה + gap-4 בשאר. הבלוק הלבן מכיל רק את השם. */}
        <div className="flex flex-col gap-3 px-5 pb-4 pt-4">
          <button
            type="button"
            onClick={() => router.push("/preferences?returnTo=/profile")}
            className="flex w-full items-center justify-between rounded-card bg-white px-5 py-4 shadow-soft transition active:scale-[0.98]"
          >
            <span className="font-bold text-ink">התאמות אישיות</span>
            <ChevronLeft />
          </button>

          {/* *** בקשה מפורשת - "עריכת פרופיל בין התאמות אישיות לבין הבחירות שלי" + "למה רווח כזה גדול?": השורה בתוך אותו בלוק לבן,
              צמודה ל"התאמות אישיות" באותו מרווח קטן כמו בין שתי השורות שמעליה (לא בתחילת הרשימה התחתונה, שם נוצר רווח). */}
          <button
            type="button"
            onClick={() => router.push("/places/profile/edit")}
            className="flex w-full items-center justify-between rounded-card bg-white px-5 py-4 shadow-soft transition active:scale-[0.98]"
          >
            <span className="font-bold text-ink">עריכת פרופיל</span>
            <ChevronLeft />
          </button>

          <button
            type="button"
            onClick={() => router.push("/trips")}
            className="flex items-center justify-between rounded-card bg-white px-5 py-4 shadow-soft transition active:scale-[0.98]"
          >
            {/* *** תיקון (בקשה מפורשת - "לשנות את הטיולים שלי - לבחירות
                שלי"): מוביל לאותו עמוד בדיוק (/trips) - רק שם עדכני. */}
            <span className="font-bold text-ink">הבחירות שלי</span>
            <ChevronLeft />
          </button>

          <button
            type="button"
            onClick={() => router.push("/calendar")}
            className="flex items-center justify-between rounded-card bg-white px-5 py-4 shadow-soft transition active:scale-[0.98]"
          >
            <span className="font-bold text-ink">היומן שלי</span>
            <ChevronLeft />
          </button>

          <div className="rounded-card bg-white p-4 shadow-soft">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-secondary">בקרוב</p>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between py-1.5 opacity-50">
                <span className="text-ink">שיתוף מסלול בין חברים</span>
                <span className="rounded-pill bg-bg-secondary px-2 py-0.5 text-xs text-ink-secondary">בקרוב</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/terms")}
            className="flex items-center justify-between rounded-card bg-white px-5 py-4 shadow-soft transition active:scale-[0.98]"
          >
            <span className="text-ink">מדיניות פרטיות ותנאי שימוש</span>
            <ChevronLeft />
          </button>

          <button
            type="button"
            onClick={() => router.push("/support")}
            className="flex items-center justify-between rounded-card bg-white px-5 py-4 shadow-soft transition active:scale-[0.98]"
          >
            <div className="text-start">
              <p className="font-bold text-ink">שירות לקוחות</p>
              <p className="text-xs text-ink-secondary">יש לכם שאלה? כתבו לנו</p>
            </div>
            <ChevronLeft />
          </button>

          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="flex items-center justify-between rounded-card bg-white px-5 py-4 shadow-soft transition active:scale-[0.98]"
          >
            <div className="text-start">
              <p className="font-bold text-ink">הזמן חברים</p>
              <p className="text-xs text-ink-secondary">שתף ותזכה בהטבות</p>
            </div>
            <ChevronLeft />
          </button>

          <Button variant="secondary" fullWidth onClick={handleSignOut}>
            התנתק — יציאה מהחשבון
          </Button>

          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="py-2 text-center text-sm text-danger"
            >
              מחק חשבון
            </button>
          ) : (
            <div className="rounded-card bg-danger/10 p-4 text-center">
              <p className="mb-3 text-sm text-danger">פעולה בלתי הפיכה — כל הנתונים יימחקו לצמיתות.</p>
              {deleteError && <p className="mb-3 text-xs text-danger">{deleteError}</p>}
              <div className="flex gap-2">
                <Button variant="secondary" fullWidth onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                  ביטול
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  className="!bg-danger !text-white disabled:!opacity-60"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "מוחק..." : "כן, מחק את החשבון"}
                </Button>
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