import type { Metadata } from "next";
import Image from "next/image";
import { JoinRedirect } from "@/components/invite/JoinRedirect";

interface JoinPageProps {
  params: Promise<{ code: string }>;
}

const SHARE_TITLE = "TRIPLACE";
const SHARE_DESCRIPTION = "בואו לגלות את הטיול הבא שלנו יחד ב-TRIPLACE 🧳✈️";

function resolveOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://triplace.app";
}

/** מטא-דאטה ל-Share Preview (ר' דרישה #7) - מבוסס על ה-HERO האמיתי של
 *  triplace (hero-tripmatch.png, אותה תמונה שמשמשת גם ב-InviteFriendsCard
 *  וב-tripmatch/page.tsx) - לא תמונה גנרית/מומצאת. */
export async function generateMetadata({ params }: JoinPageProps): Promise<Metadata> {
  await params;
  const heroUrl = `${resolveOrigin()}/images/hero-tripmatch.png`;
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
        <Image src="/images/hero-tripmatch.png" alt="" fill className="object-cover" priority />
      </div>
      <p className="text-sm font-medium text-ink-secondary">מכינים לך את TRIPLACE...</p>
      <JoinRedirect code={code} />
    </div>
  );
}
