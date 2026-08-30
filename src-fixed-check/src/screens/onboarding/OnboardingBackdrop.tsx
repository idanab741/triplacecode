"use client";

/** רקע מטושטש לכל מסך Onboarding - צילום/תמונת ה-hero האמיתית של אותו
 *  פיצ'ר באפליקציה, עם Gaussian Blur חזק + שכבת "זכוכית" (glass) לבנה-
 *  שקופה מעליה כדי שהתוכן שמעל יישאר קריא. אותה מתכונת בדיוק בכל
 *  המסכים (אותו blur, אותה עוצמת overlay) - כדי שכל חמשת המסכים ירגישו
 *  כמו סט אחד ולא כמו חמישה מסכים נפרדים. */
export function OnboardingBackdrop({ src }: { src: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" style={{ filter: "blur(38px) saturate(1.15)", transform: "scale(1.15)" }} />
      <div className="absolute inset-0 bg-white/62" style={{ backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)" }} />
    </div>
  );
}
