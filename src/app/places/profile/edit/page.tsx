"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { updateProfile, uploadAvatar, removeAvatar } from "@/services/profile/profileService";
import { uploadSocialMedia } from "@/services/social/mediaUploadService";
import { getAvatarUrl } from "@/constants/avatar";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { rememberUsernameChange } from "@/services/social/usernameAlias";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { MainBottomNav } from "@/components/MainBottomNav";
import { usernameLockedMessage, usernameLockedUntil } from "@/services/social/usernameLimit";

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
  cover_url?: string | null;
  /** מתי שונה שם המשתמש לאחרונה (migration 0092) - שינוי אפשרי פעם ב-30 יום. */
  username_changed_at?: string | null;
}

/** שדה טקסט אחיד. *** תיקון (בקשה מפורשת - "העמוד נשבר, חורג שמאלה ובורח מהגודל של העמוד"): min-w-0 + max-w-full
 *  + appearance-none - בלי זה שדות (בעיקר type="date" בנייד) מקבלים רוחב מינימלי משלהם וחורגים מהעמוד.
 *  צבע הפוקוס תכלת (triplace) ולא סגול. */
const INPUT_CLASS =
  "block w-full min-w-0 max-w-full appearance-none rounded-card border border-ink-secondary/20 bg-white px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-[#0A6DFE]/40 disabled:opacity-60";

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
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

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
        setCoverUrl(data.profile?.cover_url ?? null);
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
        // *** תיקון (בקשה מפורשת - "למה הפרופיל לא נמצא? הוא צריך להסתנכרן ברגע שמשנים את השם!"): כתובת הפרופיל
        // כוללת את ה-username, ולכן "חזור" (וההיסטוריה) הובילו לכתובת הישנה = "פרופיל לא נמצא". זוכרים את השינוי
        // (ישן -> חדש) כדי שכתובות ישנות יופנו לחדשה, ו"חזור" למטה הולך ישר לפרופיל הנוכחי.
        rememberUsernameChange(meProfile?.username, username.trim());
      }

      if (bio !== (meProfile?.bio ?? "")) {
        await fetchJson("/api/social/profile/me", { method: "PATCH", body: JSON.stringify({ bio }) });
      }

      const usernameChanged = username.trim() !== (meProfile?.username ?? "");
      setMeProfile({
        username: username.trim(),
        bio,
        username_changed_at: usernameChanged ? new Date().toISOString() : (meProfile?.username_changed_at ?? null),
      });
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
      // *** תיקון (בקשה מפורשת - "למה זה לא משנה לי את תמונת הפרופיל?"): uploadAvatar רק מעלה את הקובץ
      // ל-storage ומחזיר כתובת - הוא *לא* שומר אותה ב-profiles.avatar_url. בלי השורה הזאת הפרופיל
      // (והפיד, והתגובות...) המשיכו להציג את התמונה הישנה. (AvatarUploader.tsx עושה בדיוק את שתי הפעולות.)
      const { error } = await updateProfile(user.id, { avatar_url: url });
      if (error) throw error;
      setAvatarUrl(url);
      await refreshProfile();
    } catch (err) {
      setBasicsMessage({ type: "error", text: err instanceof Error ? `שגיאה בהחלפת התמונה: ${err.message}` : "שגיאה בהחלפת התמונה" });
    } finally {
      setUploadingPhoto(false);
    }
  }

  /** קאבר: העלאה + שמירה ב-profiles.cover_url (אותו מנגנון קיים). */
  async function handleCoverChange(file: File | undefined) {
    if (!file || !user) return;
    setUploadingCover(true);
    try {
      const uploaded = await uploadSocialMedia(createClient(), user.id, file);
      await fetchJson("/api/social/profile/me", { method: "PATCH", body: JSON.stringify({ coverUrl: uploaded.url }) });
      setCoverUrl(uploaded.url);
    } catch (err) {
      setBasicsMessage({ type: "error", text: err instanceof Error ? `שגיאה בהחלפת הקאבר: ${err.message}` : "שגיאה בהחלפת הקאבר" });
    } finally {
      setUploadingCover(false);
    }
  }

  /** הסרת הקאבר: cover_url = null. בפרופיל נשאר רק המסגרת הריקה (העיגול הגדול לבן). */
  async function handleRemoveCover() {
    await fetchJson("/api/social/profile/me", { method: "PATCH", body: JSON.stringify({ coverUrl: null }) });
    setCoverUrl(null);
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

  const usernameLocked = usernameLockedUntil(meProfile?.username_changed_at);

  return (
    <div className="min-h-screen max-w-full overflow-x-clip bg-white pb-28">
      {/* *** תיקון (בקשה מפורשת - "שהבר העליון יהיה triplace ולא places"): הבר התכלת של triplace (אותו בר כמו
          בעמוד הבית) עם כפתור חזור במקום הצ'אט. */}
      <HomeStatusBarTint />
      <CollapsibleTopBar
        onBack={() => {
          // ישר לפרופיל שלי בשם הנוכחי (לא router.back() - הוא היה חוזר לכתובת עם ה-username הישן אחרי שינוי שם).
          const current = (meProfile?.username ?? "").trim();
          if (current) router.replace(`/places/profile/${current}`);
          else router.replace("/places/profile/me");
        }}
      />

      {/* *** בקשה מפורשת - "קאבר בצורת קאבר (מלבן), ופרופיל בצורת עיגול באמצע שלו למטה (כמו בכל מקום), ופלוס לשינוי/עריכה":
          מלבן הקאבר בראש העמוד (-mt-8 = נכנס מתחת לפינות המעוגלות של הבר, בלי רווח לבן ביניהם - כמו בעמוד הפרופיל),
          ועיגול תמונת הפרופיל ממורכז ויושב על קצהו התחתון. כל אחד עם "+" כחול להחלפה (בחירת תמונה מהמכשיר).
          קאבר ברירת המחדל (בלי קאבר משלכם) = הנוף עם ה-HERO, חתוך למלבן. הסרה - קישורים אדומים מתחת. */}
      <div className="relative -mt-16 h-60 w-full overflow-hidden bg-bg-secondary">
        {/* *** תיקון (בקשה מפורשת - "זה לא אמור להיות הקאבר כשאין תמונה! זה אמור להיות ריק וגנרי"): בעמוד העריכה,
            בלי קאבר משלכם, מוצג מלבן ריק וגנרי (רקע אפור-בהיר + אייקון תמונה) - לא ה-HERO. ה-HERO הוא רק ברירת
            המחדל שמוצגת בעמוד הפרופיל עצמו. */}
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#f1f3f8] to-[#e4e8f0] pb-16 text-ink-secondary/45">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="m21 16-5-5-8 8" />
            </svg>
          </div>
        )}
        {uploadingCover && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-[12.5px] font-semibold text-white">מעלה...</span>
        )}
        {/* *** בקשה מפורשת - "ברגע שמעלים תמונה הפלוס הופך למינוס בשביל למחוק": בלי קאבר - "+" (בחירת תמונה);
            עם קאבר - "−" שמוחק אותו. */}
        {coverUrl ? (
          <button
            type="button"
            onClick={handleRemoveCover}
            aria-label="הסרת קאבר"
            className="absolute bottom-3 end-3 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-soft"
            style={{ background: "linear-gradient(150deg, #22B8FD, #007CFE)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
        ) : (
          <label
            aria-label="הוספת קאבר"
            className="absolute bottom-3 end-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-white shadow-soft"
            style={{ background: "linear-gradient(150deg, #22B8FD, #007CFE)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingCover}
              onChange={(e) => handleCoverChange(e.target.files?.[0])}
            />
          </label>
        )}
      </div>

      {/* *** תיקון (בקשה מפורשת - "בעריכת פרופיל אי אפשר לערוך את הקאבר!"): העוטף הזה (-mt-14, z-10) חופף את 56px
          התחתונים של הקאבר לכל רוחב המסך, ולכן חסם את הלחיצה על כפתור ה-"+" של הקאבר (שיושב שם, 12px מהקצה התחתון).
          pointer-events-none על העוטף, ו-pointer-events-auto רק על העיגול עצמו - הלחיצות עוברות לקאבר. */}
      <div className="pointer-events-none relative z-10 -mt-14 flex flex-col items-center">
        <div className="pointer-events-auto relative h-28 w-28">
          <span className="block h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-bg-secondary shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAvatarUrl(avatarUrl)} alt="" className="h-full w-full object-cover" />
          </span>
          {uploadingPhoto && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35 text-[11.5px] font-semibold text-white">מעלה...</span>
          )}
          {avatarUrl ? (
            <button
              type="button"
              onClick={handleRemovePhoto}
              aria-label="הסרת תמונת פרופיל"
              className="absolute -bottom-0.5 -end-0.5 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-soft"
              style={{ background: "linear-gradient(150deg, #22B8FD, #007CFE)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12h14" />
              </svg>
            </button>
          ) : (
            <label
              aria-label="הוספת תמונת פרופיל"
              className="absolute -bottom-0.5 -end-0.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-white shadow-soft"
              style={{ background: "linear-gradient(150deg, #22B8FD, #007CFE)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingPhoto}
                onChange={(e) => handlePhotoChange(e.target.files?.[0])}
              />
            </label>
          )}
        </div>

        <h1 className="mt-3 text-[17px] font-bold text-ink">עריכת פרופיל</h1>

      </div>

      <div className="h-6" />

      {/* פרטים בסיסיים */}
      <div className="flex flex-col gap-3.5 px-4">
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">שם משתמש</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={usernameLocked !== null}
            dir="ltr"
            className={INPUT_CLASS}
          />
          {/* *** בקשה מפורשת - "שם משתמש אפשר לשנות רק פעם בחודש": נעול (עם התאריך) עד שעוברים 30 יום מהשינוי האחרון */}
          <p className="mt-1 text-[11.5px] text-ink-secondary">
            {usernameLocked ? usernameLockedMessage(usernameLocked) : "אפשר לשנות שם משתמש פעם בחודש."}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">שם מלא</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">עיר מגורים</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">תאריך לידה</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">ביו</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="קצת עליי..."
            className="block w-full min-w-0 max-w-full resize-none rounded-card border border-ink-secondary/20 p-3 text-[14px] text-ink placeholder:text-ink-secondary/60 focus:outline-none focus:ring-2 focus:ring-[#0A6DFE]/40"
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
          style={{ background: "linear-gradient(150deg, #22B8FD, #007CFE)" }}
        >
          {savingBasics ? "שומר..." : "שמירה"}
        </button>
      </div>

      {/* אימייל */}
      <div className="mt-6 flex flex-col gap-3 border-t border-ink-secondary/10 px-4 pt-5">
        <h2 className="text-[14.5px] font-bold text-ink">אימייל</h2>
        <p className="break-all text-[12.5px] text-ink-secondary" dir="ltr">
          {user?.email}
        </p>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">אימייל חדש</label>
          <input
            type="email"
            dir="ltr"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">סיסמה נוכחית (לאימות)</label>
          <input
            type="password"
            value={currentPasswordForEmail}
            onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
            className={INPUT_CLASS}
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
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-ink-secondary">סיסמה חדשה</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={INPUT_CLASS}
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

      <MainBottomNav active="profile" />
    </div>
  );
}
