"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/services/auth/authService";
import { AvatarUploader } from "@/components/AvatarUploader";
import { MainBottomNav } from "@/components/MainBottomNav";
import { InviteFriendsModal } from "@/components/invite/InviteFriendsModal";
import { TokenBalancePill } from "@/screens/profile/TokenBalancePill";
import { Button, Field, Input, Skeleton } from "@/components/ui";
import { updateProfile, uploadAvatar } from "@/services/profile/profileService";

export default function ProfilePage() {
  const { user, loading, profile, profileLoading, refreshProfile } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  async function handleSaveName() {
    if (!user) return;
    setSavingName(true);
    setSaveError(null);
    try {
      if (pendingAvatarFile) {
        const url = await uploadAvatar(user.id, pendingAvatarFile);
        await updateProfile(user.id, { avatar_url: url });
        setPendingAvatarFile(null);
      }
      if (fullName.trim()) {
        await updateProfile(user.id, { full_name: fullName.trim() });
      }
      await refreshProfile();
    } catch {
      setSaveError("שמירת השינויים נכשלה, נסו שוב");
    } finally {
      setSavingName(false);
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
          <Skeleton className="h-28 w-28 rounded-full" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      <div className="mx-auto max-w-xl">
        <div className="overflow-hidden rounded-b-[50px] bg-white">
          <div className="relative w-full">
            <Image
              src="/images/hero-profile-setup.png"
              alt="קמע triplace"
              width={800}
              height={500}
              priority
              className="h-auto w-full"
            />
            <div
              className="absolute aspect-square -translate-x-1/2 -translate-y-1/2"
              style={{ left: "49.73%", top: "71.7%", width: "42%" }}
            >
              {user && (
                <AvatarUploader
                  userId={user.id}
                  initialUrl={profile?.avatar_url}
                  fluid
                  bordered={false}
                  deferSave
                  onFileSelected={setPendingAvatarFile}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 px-5 pb-6 pt-0 text-center">
            <div>
              <h1 className="text-xl font-bold text-ink">{profile?.full_name || "המשתמש שלי"}</h1>
              <p className="text-sm text-ink-secondary">{profile?.city || "—"}</p>
              <div className="mt-2 flex justify-center">
                <TokenBalancePill />
              </div>
            </div>

            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={() => router.push("/onboarding")}
                className="flex w-full items-center justify-between rounded-card border-2 border-accent bg-white px-5 py-4 shadow-soft transition active:scale-[0.98]"
              >
                <span className="font-bold text-ink">הכירו את triplace</span>
                <ChevronLeft />
              </button>

              <button
                type="button"
                onClick={() => router.push("/preferences?returnTo=/profile")}
                className="flex w-full items-center justify-between rounded-card bg-white px-5 py-4 shadow-soft transition active:scale-[0.98]"
              >
                <span className="font-bold text-ink">התאמות אישיות</span>
                <ChevronLeft />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-4 pt-6">
          <div className="rounded-card bg-white p-4 shadow-soft">
            <p className="mb-3 font-bold text-ink">פרטים אישיים</p>
            <div className="flex flex-col gap-3">
              <Field label="שם מלא">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <Field label="אימייל">
                <Input value={user?.email ?? ""} disabled />
              </Field>
              {saveError && <p className="text-center text-xs text-danger">{saveError}</p>}
              <Button
                variant="primary"
                fullWidth
                onClick={handleSaveName}
                disabled={savingName || (fullName.trim() === profile?.full_name && !pendingAvatarFile)}
              >
                {savingName ? "שומר..." : "שמור שינויים"}
              </Button>
              <button
                type="button"
                onClick={() => router.push("/auth/change-password")}
                className="text-center text-sm font-medium text-accent"
              >
                שינוי סיסמה
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/trips")}
            className="flex items-center justify-between rounded-card bg-white px-5 py-4 shadow-soft transition active:scale-[0.98]"
          >
            <span className="font-bold text-ink">הטיולים שלי</span>
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