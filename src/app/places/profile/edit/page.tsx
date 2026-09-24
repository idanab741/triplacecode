"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
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

/**
 * *** שדרוג עיצובי (בקשה מפורשת - "נשדרג לפי העיצוב החדש של העמודים שלנו, צבעים חדים יותר"):
 * אותו קו כמו עמוד האטרקציה - רקע לבן, טקסט שחור חד, כותרות קטע מודגשות, שדות במשטח אפור מלא
 * עם אייקון, וכחול triplace אחיד ומלא (בלי גרדיאנט דהוי). אימייל וסיסמה - שורות בסגנון פייסבוק
 * שנפתחות בלחיצה, כדי שהעמוד לא יהיה עמוס שדות.
 * *** נשמר מתיקון קודם ("העמוד נשבר, חורג שמאלה"): min-w-0 + max-w-full + appearance-none בשדות.
 */
const BLUE = "#0A6DFE";
const INK = { "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties;

const INPUT_CLASS =
  "block h-12 w-full min-w-0 max-w-full appearance-none bg-transparent text-[15px] text-ink placeholder:text-ink-secondary/70 focus:outline-none disabled:opacity-60";

const iconProps = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const Icons = {
  at: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
    </svg>
  ),
  user: (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  pin: (
    <svg {...iconProps}>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  ),
  cake: (
    <svg {...iconProps}>
      <path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 5 0M12 12V8M12 5.5c.8-.8.8-1.7 0-2.5-.8.8-.8 1.7 0 2.5z" />
    </svg>
  ),
  text: (
    <svg {...iconProps}>
      <path d="M4 6h16M4 11h16M4 16h10" />
    </svg>
  ),
  mail: (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  ),
  lock: (
    <svg {...iconProps}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  plus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  minus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  ),
};

/** כותרת קטע מודגשת + תוכן - כמו "כתובת" / "שעות פעילות" בעמוד האטרקציה. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-5 pt-7">
      <h2 className="mb-3 text-[17px] font-bold text-ink">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** שדה: תווית מעל, ומתחתיה משטח אפור מלא עם אייקון בתחילתו. טבעת כחולה בפוקוס. */
function Field({ label, icon, hint, children }: { label: string; icon: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink">{label}</span>
        <span className="flex min-w-0 items-start gap-3 rounded-xl bg-[#F1F2F5] px-3.5 transition-shadow focus-within:bg-white focus-within:shadow-[inset_0_0_0_1.5px_#0A6DFE]">
          <span className="flex h-12 shrink-0 items-center text-ink-secondary">{icon}</span>
          <span className="min-w-0 flex-1">{children}</span>
        </span>
      </label>
      {hint && <p className="mt-1.5 text-[12.5px] leading-snug text-ink-secondary">{hint}</p>}
    </div>
  );
}

function Message({ message }: { message: { type: "success" | "error"; text: string } | null }) {
  if (!message) return null;
  const ok = message.type === "success";
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-[13.5px] font-medium leading-snug ${ok ? "bg-[#E8F7EE] text-[#0F7A3D]" : "bg-[#FDECEC] text-[#C4282D]"}`}
    >
      <span aria-hidden="true" className="mt-px font-bold">{ok ? "✓" : "!"}</span>
      {message.text}
    </p>
  );
}

/** שורה בסגנון פייסבוק (אייקון, כותרת, ערך נוכחי, חץ) שנפתחת לטופס. */
function ExpandRow({
  icon,
  title,
  value,
  open,
  onToggle,
  children,
}: {
  icon: ReactNode;
  title: string;
  value: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-black/[0.06] last:border-b-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3.5 py-3.5 text-start transition active:opacity-70">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F1F2F5] text-ink">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{title}</span>
          <span className="block truncate text-[13px] text-ink-secondary">{value}</span>
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 text-ink-secondary transition-transform duration-300"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 pb-5 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** כפתור עגול קטן על הקאבר/התמונה: "+" להעלאה, "−" להסרה (בקשה קודמת - הפלוס הופך למינוס). */
const ROUND_BTN = "flex h-9 w-9 items-center justify-center rounded-full text-white shadow-[0_2px_8px_rgba(0,0,0,0.25)] ring-[3px] ring-white transition active:scale-95";

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
  const [openRow, setOpenRow] = useState<"email" | "password" | null>(null);

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
  const displayName = fullName.trim() || profile?.full_name || "";
  const displayUsername = (meProfile?.username ?? "").trim();

  return (
    <div className="min-h-screen max-w-full overflow-x-clip bg-white pb-28" style={INK}>
      {/* הבר התכלת של triplace (אותו בר כמו בעמוד הבית) עם כפתור חזור. */}
      <HomeStatusBarTint />
      <CollapsibleTopBar
        onBack={() => {
          // ישר לפרופיל שלי בשם הנוכחי (לא router.back() - הוא היה חוזר לכתובת עם ה-username הישן אחרי שינוי שם).
          const current = (meProfile?.username ?? "").trim();
          if (current) router.replace(`/places/profile/${current}`);
          else router.replace("/places/profile/me");
        }}
      />

      {/* קאבר (מלבן) + תמונת פרופיל (עיגול ממורכז על הקצה התחתון), כל אחד עם "+" להעלאה / "−" להסרה. */}
      <div className="relative -mt-16 h-60 w-full overflow-hidden bg-[#E9ECF1]">
        {/* בלי קאבר משלכם - מלבן ריק וגנרי (לא ה-HERO, שמוצג רק בעמוד הפרופיל עצמו). */}
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center pb-10 text-[#9AA3B2]">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="m21 16-5-5-8 8" />
            </svg>
          </div>
        )}
        {uploadingCover && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[13px] font-semibold text-white">מעלה...</span>
        )}
        {coverUrl ? (
          <button type="button" onClick={handleRemoveCover} aria-label="הסרת קאבר" className={`absolute bottom-3 end-3 ${ROUND_BTN}`} style={{ background: BLUE }}>
            {Icons.minus}
          </button>
        ) : (
          <label aria-label="הוספת קאבר" className={`absolute bottom-3 end-3 cursor-pointer ${ROUND_BTN}`} style={{ background: BLUE }}>
            {Icons.plus}
            <input type="file" accept="image/*" className="hidden" disabled={uploadingCover} onChange={(e) => handleCoverChange(e.target.files?.[0])} />
          </label>
        )}
      </div>

      {/* pointer-events-none על העוטף (שחופף את תחתית הקאבר), ורק העיגול לחיץ - כדי שכפתור הקאבר יישאר לחיץ. */}
      <div className="pointer-events-none relative z-10 -mt-16 flex flex-col items-center px-5">
        <div className="pointer-events-auto relative h-32 w-32">
          <span className="block h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-[#E9ECF1] shadow-[0_4px_16px_rgba(15,20,25,0.12)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAvatarUrl(avatarUrl)} alt="" className="h-full w-full object-cover" />
          </span>
          {uploadingPhoto && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-[12px] font-semibold text-white">מעלה...</span>
          )}
          {avatarUrl ? (
            <button type="button" onClick={handleRemovePhoto} aria-label="הסרת תמונת פרופיל" className={`absolute bottom-1 end-1 ${ROUND_BTN}`} style={{ background: BLUE }}>
              {Icons.minus}
            </button>
          ) : (
            <label aria-label="הוספת תמונת פרופיל" className={`absolute bottom-1 end-1 cursor-pointer ${ROUND_BTN}`} style={{ background: BLUE }}>
              {Icons.plus}
              <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto} onChange={(e) => handlePhotoChange(e.target.files?.[0])} />
            </label>
          )}
        </div>

        <h1 className="mt-3 max-w-full truncate text-[24px] font-bold leading-tight tracking-tight text-ink">{displayName || "עריכת פרופיל"}</h1>
        {displayUsername && (
          <p className="mt-0.5 max-w-full truncate text-[14px] text-ink-secondary" dir="ltr">
            @{displayUsername}
          </p>
        )}
      </div>

      {/* פרטים אישיים */}
      <Section title="פרטים אישיים">
        <Field
          label="שם משתמש"
          icon={Icons.at}
          // שם משתמש - אפשר לשנות פעם בחודש; נעול (עם התאריך) עד שעוברים 30 יום מהשינוי האחרון.
          hint={usernameLocked ? usernameLockedMessage(usernameLocked) : "אפשר לשנות שם משתמש פעם בחודש."}
        >
          <input value={username} onChange={(e) => setUsername(e.target.value)} disabled={usernameLocked !== null} dir="ltr" className={`${INPUT_CLASS} text-end`} />
        </Field>
        <Field label="שם מלא" icon={Icons.user}>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label="עיר מגורים" icon={Icons.pin}>
          <input value={city} onChange={(e) => setCity(e.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label="תאריך לידה" icon={Icons.cake}>
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={INPUT_CLASS} />
        </Field>
        <Field label="ביו" icon={Icons.text}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="ספרו קצת על עצמכם..."
            className="block w-full min-w-0 max-w-full resize-none bg-transparent py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-secondary/70 focus:outline-none"
          />
        </Field>

        <Message message={basicsMessage} />

        <button
          type="button"
          onClick={handleSaveBasics}
          disabled={savingBasics}
          className="h-12 rounded-xl text-[15.5px] font-semibold mt-1 w-full text-white transition active:scale-[0.98] disabled:opacity-50"
          style={{ background: BLUE }}
        >
          {savingBasics ? "שומרים..." : "שמירת שינויים"}
        </button>
      </Section>

      {/* חשבון ואבטחה - אימייל וסיסמה, עם ההגבלות האמיתיות (אימות סיסמה נוכחית, מייל אימות לכתובת החדשה). */}
      <section className="px-5 pt-8">
        <h2 className="mb-1 text-[17px] font-bold text-ink">חשבון ואבטחה</h2>

        <ExpandRow
          icon={Icons.mail}
          title="אימייל"
          value={<span dir="ltr">{user?.email}</span>}
          open={openRow === "email"}
          onToggle={() => setOpenRow((r) => (r === "email" ? null : "email"))}
        >
          <Field label="אימייל חדש" icon={Icons.mail}>
            <input type="email" dir="ltr" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={`${INPUT_CLASS} text-end`} />
          </Field>
          <Field label="סיסמה נוכחית (לאימות)" icon={Icons.lock}>
            <input type="password" value={currentPasswordForEmail} onChange={(e) => setCurrentPasswordForEmail(e.target.value)} className={INPUT_CLASS} />
          </Field>
          <Message message={emailMessage} />
          <button
            type="button"
            onClick={handleChangeEmail}
            disabled={savingEmail}
            className="h-12 rounded-xl text-[15.5px] font-semibold w-full bg-[#EFF1F4] text-ink transition active:scale-[0.98] disabled:opacity-50"
          >
            {savingEmail ? "שולחים..." : "עדכון אימייל"}
          </button>
          <p className="text-[12.5px] leading-snug text-ink-secondary">נשלח מייל אימות לכתובת החדשה. השינוי ייכנס לתוקף רק אחרי האישור שם.</p>
        </ExpandRow>

        <ExpandRow
          icon={Icons.lock}
          title="סיסמה"
          value="••••••••"
          open={openRow === "password"}
          onToggle={() => setOpenRow((r) => (r === "password" ? null : "password"))}
        >
          <Field label="סיסמה נוכחית" icon={Icons.lock}>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={INPUT_CLASS} />
          </Field>
          <Field label="סיסמה חדשה" icon={Icons.lock} hint="לפחות 6 תווים.">
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={INPUT_CLASS} />
          </Field>
          <Message message={passwordMessage} />
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={savingPassword}
            className="h-12 rounded-xl text-[15.5px] font-semibold w-full bg-[#EFF1F4] text-ink transition active:scale-[0.98] disabled:opacity-50"
          >
            {savingPassword ? "מעדכנים..." : "עדכון סיסמה"}
          </button>
        </ExpandRow>
      </section>

      <MainBottomNav active="profile" />
    </div>
  );
}
