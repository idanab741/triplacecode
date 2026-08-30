import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { JoinRedirect } from "@/components/invite/JoinRedirect";

interface JoinPageProps {
  params: Promise<{ code: string }>;
}

const SHARE_TITLE = "🎉 הוזמנת להצטרף ל-TRIPLACE";
const SHARE_DESCRIPTION = "חבר/ה הזמינו אותך לגלות איתם את הטיול הבא - טיולים, המלצות ומסלולים מותאמים אישית. בואו נתחיל לתכנן ✈️🧳";

/**
 * *** תיקון (באג אמיתי - "אין תמונה בתצוגה המקדימה בוואטסאפ"): הגרסה
 * הקודמת בנתה את כתובת התמונה מ-NEXT_PUBLIC_APP_URL, ואם המשתנה הזה לא
 * הוגדר בפרודקשן (בדיוק המצב ב-triplacecode20.vercel.app) - היא נפלה
 * חזרה ל-"https://triplace.app" קבוע בקוד, דומיין שהוא כלל לא הדומיין
 * האמיתי של הדיפלוי. הזחף שווצאפ ניסה להוריד תמונה מדומיין לא קיים/לא
 * שלנו, קיבל שגיאה, ולכן לא הציג שום תמונה. עכשיו קוראים את הדומיין
 * האמיתי מכותרות הבקשה עצמה (host, ר' next/headers) - זה תמיד הדומיין
 * שממנו הלינק בפועל נטען, גם ב-preview deployments של Vercel וגם
 * בפרודקשן, בלי תלות בהגדרת משתנה סביבה. NEXT_PUBLIC_APP_URL עדיין
 * משמש כברירת מחדל אם מכל סיבה שהיא אין כותרות בקשה (למשל build-time
 * מוקדם), וה-domain הקבוע הוא רק רשת ביטחון אחרונה.
 */
async function resolveOrigin(): Promise<string> {
  try {
    const headersList = await headers();
    const host = headersList.get("host");
    if (host) {
      const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
      return `${protocol}://${host}`;
    }
  } catch {
    // headers() לא זמין בהקשר הזה - נופלים לברירות המחדל למטה
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://triplace.app";
}

/** מטא-דאטה ל-Share Preview (ר' דרישה #7) - מבוסס על הנכס הוויזואלי
 *  הייעודי לפיצ'ר "הזמן חברים" (hero-invite-friends.jpg, אותה תמונה
 *  שמוצגת גם ב-InviteFriendsCard) - לא תמונה גנרית/מומצאת. */
export async function generateMetadata({ params }: JoinPageProps): Promise<Metadata> {
  await params;
  const origin = await resolveOrigin();
  const heroUrl = `${origin}/images/hero-invite-friends.jpg`;
  return {
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    openGraph: {
      title: SHARE_TITLE,
      description: SHARE_DESCRIPTION,
      images: [{ url: heroUrl, width: 1200, height: 630, alt: "TRIPLACE" }],
    },
    twitter: {
      card: "summary_large_image",
      title: SHARE_TITLE,
      description: SHARE_DESCRIPTION,
      images: [heroUrl],
    },
  };
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { code } = await params;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <div className="relative h-20 w-20 overflow-hidden rounded-full shadow-soft">
        <Image src="/images/hero-invite-friends.jpg" alt="" fill className="object-cover" priority />
      </div>
      <p className="text-sm font-medium text-ink-secondary">מכינים לך את TRIPLACE...</p>
      <JoinRedirect code={code} />
    </div>
  );
}
