"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { updateProfile, uploadAvatar, removeAvatar } from "@/services/profile/profileService";
import { getAvatarUrl } from "@/constants/avatar";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "שגיאה");
  }
  return res.json();
}

interface MeProfile {
  username: string | null;
  bio: string | null;
}

/**
 * *** תוספת (בקשה מפורשת - "עריכת פרופיל צריכה להביא אותי לעמוד נוסף
 * - שאני יכול לערוך את כל הפרופיל - שם משתמש, שם פרטי, אימייל,
 * מגורים, BIO, תאריך לידה, סיסמה, תמונה! הכל!"): עמוד עצמאי, לא עוד
 * טוגל-עריכה בתוך עמוד הפרופיל עצמו.
 *
 * *** בכוונה עם ההגבלות האמיתיות (בקשה מפורשת - "עם ההגבלות האמיתיות"):
 * - שינוי אימייל: supabase.auth.updateUser({email}) לא משנה את
 *   האימייל מיד - Supabase שולח מייל אימות לכתובת ה*חדשה*, והשינוי
 *   נכנס לתוקף רק אחרי שלוחצים על הקישור שם. לא מציגים "נשמר!" כאילו
 *   זה כבר קרה - ההודעה כאן משקפת את זה במפורש.
 * - שינוי סיסמה: לפני הקריאה בפועל ל-updateUser({password}), מוודאים
 *   שהמשתמש באמת יודע את הסיסמה הנוכחית - signInWithPassword איתה.
 *   אם היא שגויה, זה נכשל *לפני* שהסיסמה משתנה - לא מסתמכים רק על
 *   "המשתמש כבר מחובר אז זה בסדר" (מישהו שהשאיר sessions פתוח על
 *   מכשיר לא-שלו לא אמור להיות מסוגל לשנות סיסמה בלי לדעת אותה).
 */
export default function EditProfilePage() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  const [meProfile, setMeProfile] = useState<MeProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [savingBasics, setSavingBasics] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [basicsMessage, setBasicsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [emailMessage, setEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setCity(profile.city ?? "");
      setBirthDate(profile.birth_date ?? "");
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  useEffect(() => {
    fetchJson<{ profile: MeProfile }>("/api/social/profile/me")
      .then((data) => {
        setMeProfile(data.profile);
        setUsername(data.profile?.username ?? "");
        setBio(data.profile?.bio ?? "");
      })
      .catch(() => {});
  }, []);

  async function handleSaveBasics() {
    if (!user) return;
    setSavingBasics(true);
    setBasicsMessage(null);
    try {
      await updateProfile(user.id, {
        full_name: fullName.trim() || null,
        city: city.trim() || null,
        birth_date: birthDate || null,
      });

      if (username.trim() && username.trim() !== (meProfile?.username ?? "")) {
        await fetchJson("/api/social/username", { method: "POST", body: JSON.stringify({ username: username.trim() }) });
      }

      if (bio !== (meProfile?.bio ?? "")) {
        await fetchJson("/api/social/profile/me", { method: "PATCH", body: JSON.stringify({ bio }) });
      }

      setMeProfile({ username: username.trim(), bio });
      await refreshProfile();
      setBasicsMessage({ type: "success", text: "הפרופיל נשמר בהצלחה" });
    } catch (err) {
      setBasicsMessage({ type: "error", text: err instanceof Error ? err.message : "שגיאה בשמירה" });
    } finally {
      setSavingBasics(false);
    }
  }

  async function handlePhotoChange(file: File | undefined) {
    if (!file || !user) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadAvatar(user.id, file);
      setAvatarUrl(url);
      await refreshProfile();
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRemovePhoto() {
    if (!user) return;
    await removeAvatar(user.id);
    setAvatarUrl(null);
    await refreshProfile();
  }

  async function handleChangeEmail() {
    if (!newEmail.trim() || !user?.email || !currentPasswordForEmail) {
      setEmailMessage({ type: "error", text: "יש למלא את הסיסמה הנוכחית ואת כתובת המייל החדשה" });
      return;
    }
    setSavingEmail(true);
    setEmailMessage(null);
    try {
      const supabase = createClient();
      // *** מוודאים שזה באמת בעל החשבון לפני שינוי אימייל - אותו
      // עיקרון בדיוק כמו שינוי סיסמה למטה.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPasswordForEmail,
      });
      if (signInError) throw new Error("הסיסמה שגויה");

      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;

      setEmailMessage({
        type: "success",
        text: `נשלח מייל אימות ל-${newEmail.trim()} - השינוי ייכנס לתוקף רק אחרי שתלחץ/י על הקישור שם`,
      });
      setNewEmail("");
      setCurrentPasswordForEmail("");
    } catch (err) {
      setEmailMessage({ type: "error", text: err instanceof Error ? err.message : "שגיאה בשינוי האימייל" });
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleChangePassword() {
    if (!user?.email || !currentPassword || !newPassword) {
      setPasswordMessage({ type: "error", text: "יש למלא את הסיסמה הנוכחית והחדשה" });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "הסיסמה החדשה חייבת להיות לפחות 6 תווים" });
      return;
    }
    setSavingPassword(true);
    setPasswordMessage(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (signInError) throw new Error("הסיסמה הנוכחית שגויה");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPasswordMessage({ type: "success", text: "הסיסמה עודכנה בהצלחה" });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordMessage({ type: "error", text: err instanceof Error ? err.message : "שגיאה בשינוי הסיסמה" });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="sticky top-0 z-30 flex items-center justify-center border-b border-ink-secondary/10 bg-white px-4 py-3.5">
        <button type="button" onClick={() => router.back()} aria-label="חזור" className="absolute end-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-[15px] font-bold text-ink">עריכת פרופיל</h1>
      </header>

      {/* תמונת פרופיל - עריכה/הסרה עברו לכאן לגמרי (בקשה מפורשת -
          "אפשר למחוק את התמונה בתוך עמוד עריכת פרופיל") */}
      <div className="flex flex-col items-center gap-2 py-6">
        <div className="relative h-24 w-24">
          <span className="block h-24 w-24 overflow-hidden rounded-full bg-bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAvatarUrl(avatarUrl)} alt="" className="h-full w-full object-cover" />
          </span>
          <label
            className="absolute -bottom-0.5 -end-0.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white shadow-soft"
            style={{ background: "var(--color-places-purple)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingPhoto}
              onChange={(e) => handlePhotoChange(e.target.files?.[0])}
            />
          </label>
        </div>
        {uploadingPhoto && <p className="text-[11.5px] text-ink-secondary">מעלה...</p>}
        {avatarUrl && !uploadingPhoto && (
          <button type="button" onClick={handleRemovePhoto} className="text-[12.5px] font-semibold text-red-500">
            הסר תמונה
          </button>
        )}
      </div>

      {/* פרטים בסיסיים */}
      <div className="flex flex-col gap-3.5 px-4">
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">שם משתמש</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            dir="ltr"
            className="w-full rounded-card border border-ink-secondary/20 px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">שם מלא</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-card border border-ink-secondary/20 px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">עיר מגורים</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-card border border-ink-secondary/20 px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">תאריך לידה</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full rounded-card border border-ink-secondary/20 px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">ביו</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="קצת עליי..."
            className="w-full resize-none rounded-card border border-ink-secondary/20 p-3 text-[14px] text-ink placeholder:text-ink-secondary/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
          />
        </div>

        {basicsMessage && (
          <p className={`rounded-card px-3 py-2 text-[12.5px] ${basicsMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {basicsMessage.text}
          </p>
        )}

        <button
          type="button"
          onClick={handleSaveBasics}
          disabled={savingBasics}
          className="rounded-pill py-3 text-[14px] font-bold text-white disabled:opacity-50"
          style={{ background: "var(--color-places-purple)" }}
        >
          {savingBasics ? "שומר..." : "שמירה"}
        </button>
      </div>

      {/* אימייל */}
      <div className="mt-6 flex flex-col gap-3 border-t border-ink-secondary/10 px-4 pt-5">
        <h2 className="text-[14.5px] font-bold text-ink">אימייל</h2>
        <p className="text-[12.5px] text-ink-secondary" dir="ltr">
          {user?.email}
        </p>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">אימייל חדש</label>
          <input
            type="email"
            dir="ltr"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full rounded-card border border-ink-secondary/20 px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">סיסמה נוכחית (לאימות)</label>
          <input
            type="password"
            value={currentPasswordForEmail}
            onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
            className="w-full rounded-card border border-ink-secondary/20 px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
          />
        </div>
        {emailMessage && (
          <p className={`rounded-card px-3 py-2 text-[12.5px] ${emailMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {emailMessage.text}
          </p>
        )}
        <button
          type="button"
          onClick={handleChangeEmail}
          disabled={savingEmail}
          className="rounded-pill border border-ink-secondary/20 py-2.5 text-[13px] font-bold text-ink disabled:opacity-50"
        >
          {savingEmail ? "שולח..." : "עדכון אימייל"}
        </button>
        <p className="text-[11px] text-ink-secondary">ישלח מייל אימות לכתובת החדשה - השינוי ייכנס לתוקף רק לאחר האישור שם.</p>
      </div>

      {/* סיסמה */}
      <div className="mt-6 flex flex-col gap-3 border-t border-ink-secondary/10 px-4 pt-5">
        <h2 className="text-[14.5px] font-bold text-ink">סיסמה</h2>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">סיסמה נוכחית</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-card border border-ink-secondary/20 px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">סיסמה חדשה</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-card border border-ink-secondary/20 px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
          />
        </div>
        {passwordMessage && (
          <p className={`rounded-card px-3 py-2 text-[12.5px] ${passwordMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {passwordMessage.text}
          </p>
        )}
        <button
          type="button"
          onClick={handleChangePassword}
          disabled={savingPassword}
          className="rounded-pill border border-ink-secondary/20 py-2.5 text-[13px] font-bold text-ink disabled:opacity-50"
        >
          {savingPassword ? "מעדכן..." : "עדכון סיסמה"}
        </button>
      </div>
    </div>
  );
}
