import Image from "next/image";
import { Screen } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";

/** מסך "בקרוב" ייעודי לקהילה - לא משתמש ב-ComingSoon הגנרי (המשותף גם
 *  לעמודי אדמין), כדי שהעיצוב היפה יותר עם הקמע לא ישפיע על מסכים אחרים. */
export default function CommunityPage() {
  return (
    <>
      <Screen>
        <div className="flex min-h-[75vh] flex-col items-center justify-center gap-5 px-6 text-center">
          <div
            className="relative flex h-48 w-48 items-center justify-center rounded-full"
            style={{ background: "radial-gradient(circle, rgba(24,119,242,0.14), transparent 70%)" }}
          >
            <div className="relative h-70 w-70">
              <Image src="/images/community-coming-soon.png" alt="" fill className="object-contain" priority />
            </div>
          </div>

          <span
            className="rounded-pill px-3 py-1 text-[12.5px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
          >
            בקרוב
          </span>

          <h1 className="text-xl font-bold text-ink">קהילה</h1>
          <p className="max-w-xs text-sm leading-relaxed text-ink-secondary">
            כאן תוכלו להתחבר למטיילים אחרים ולשתף חוויות.
          </p>
        </div>
      </Screen>
      <MainBottomNav active="community" />
    </>
  );
}
