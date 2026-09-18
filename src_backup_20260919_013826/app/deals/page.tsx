"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Screen } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { SimpleAppHeader } from "@/screens/layout/SimpleAppHeader";

/**
 * מסך "בקרוב" ייעודי לדילים על חופשות בחו״ל: אותו דפוס בדיוק כמו
 * /community (עמוד "בקרוב" ייעודי, לא ה-ComingSoon הגנרי) - הבאנר
 * (triplacedeals) מוצג במלואו, ברוחב מלא, למעלה, בדיוק כמו ה-hero
 * בעמוד "חופשה בחו''ל" עצמו. יש SimpleAppHeader עם כפתור חזרה (בניגוד
 * לקהילה) כי זה לא טאב ראשי ב-bottom nav - מגיעים אליו מקליק על כרטיס
 * (DealsComingSoonCard / סליידר "גלה עוד" בדף הבית).
 */
export default function DealsComingSoonPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-bg pb-36">
      <SimpleAppHeader onBack={() => router.back()} />

      <div className="relative w-full">
        <Image
          src="/images/discover/ai-powered.png"
          alt=""
          width={1200}
          height={675}
          priority
          className="h-auto w-full"
        />
      </div>

      <Screen withBottomNavSpacing={false}>
        <div className="flex flex-col items-center gap-4 pt-8 text-center">
          <span
            className="rounded-pill px-3 py-1 text-[12.5px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
          >
            בקרוב
          </span>

          <h1 className="text-xl font-bold text-ink">דילים על חופשות בחו״ל</h1>
          <p className="max-w-xs text-sm leading-relaxed text-ink-secondary">
            בקרוב תוכלו למצוא כאן את הדילים והמבצעים המשתלמים ביותר על חופשות בחו״ל.
          </p>
        </div>
      </Screen>

      <MainBottomNav active="home" />
    </div>
  );
}
