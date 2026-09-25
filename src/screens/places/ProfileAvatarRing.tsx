import type { ReactNode } from "react";

/**
 * *** בקשה מפורשת ("הכחול ישתנה בהתאם לרמת הפרופיל - 5,000 עוקבים צבע אחר, 100,000 צבע אחר"):
 * צבע הטבעת נקבע לפי מספר העוקבים. מהנמוכה לגבוהה - כל רמה "יוקרתית" יותר מהקודמת.
 */
export interface ProfileRingTier {
  minFollowers: number;
  name: string;
  /** מילוי הטבעת (צבע אחיד או גרדיאנט) */
  fill: string;
  /** צבע הצל/הזוהר מסביב */
  glow: string;
}

export const PROFILE_RING_TIERS: ProfileRingTier[] = [
  { minFollowers: 0, name: "כחול", fill: "#0A6DFE", glow: "rgba(10,60,150,0.45)" },
  { minFollowers: 1_000, name: "טורקיז", fill: "linear-gradient(135deg, #2DD4BF 0%, #0891B2 100%)", glow: "rgba(8,145,178,0.5)" },
  { minFollowers: 5_000, name: "סגול", fill: "linear-gradient(135deg, #A855F7 0%, #6D28D9 100%)", glow: "rgba(109,40,217,0.5)" },
  { minFollowers: 25_000, name: "ורוד", fill: "linear-gradient(135deg, #FB7185 0%, #DB2777 100%)", glow: "rgba(219,39,119,0.5)" },
  { minFollowers: 100_000, name: "זהב", fill: "linear-gradient(135deg, #FDE68A 0%, #F59E0B 45%, #B45309 100%)", glow: "rgba(217,119,6,0.55)" },
  {
    minFollowers: 1_000_000,
    name: "יהלום",
    fill: "conic-gradient(from 200deg, #60A5FA, #A78BFA, #F472B6, #FBBF24, #34D399, #60A5FA)",
    glow: "rgba(167,139,250,0.6)",
  },
];

export function getProfileRingTier(followers: number | null | undefined): ProfileRingTier {
  const n = followers ?? 0;
  let tier = PROFILE_RING_TIERS[0];
  for (const t of PROFILE_RING_TIERS) if (n >= t.minFollowers) tier = t;
  return tier;
}

/**
 * תמונת הפרופיל על ה-HERO של הפרופיל: עיגול מושלם עם טבעת צבעונית דקה ושוליים לבנים סביבה.
 *
 * *** תיקון (בקשה מפורשת - "המסגרת הכחולה יושבת על הפנים... הקאבר נראה מרושל איפה שהוא משיק לה"):
 * הטבעת הייתה חלק מתמונות הרקע (profile-cover-frame / profile-default-hero, ובנוסף שכבת
 * profile-cover-ring מעל הקאבר) - עבה, לא עיגול מושלם, ותמונת הפרופיל ישבה על החלק הפנימי שלה.
 * עכשיו הטבעת מצוירת ב-CSS: עיגול לבן (השוליים) ובתוכו טבעת דקה ואז התמונה. הקוטר החיצוני
 * (49.6% מרוחב ה-HERO, מרכז 50.08%/69.03%) מכסה בדיוק את הטבעת האפויה בתמונות הרקע, כך שהיא לא
 * נראית, והקצה התחתון של הקאבר נחתך נקי על השוליים הלבנים.
 */
export function ProfileAvatarRing({ children, followers }: { children: ReactNode; followers?: number | null }) {
  const tier = getProfileRingTier(followers);
  return (
    <span
      className="absolute left-[50.08%] top-[69.03%] box-border aspect-square w-[49.6%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-[1.1%]"
      style={{ boxShadow: `0 10px 28px -10px ${tier.glow}` }}
      title={`טבעת ${tier.name}`}
    >
      <span className="box-border block h-full w-full rounded-full p-[2.6%]" style={{ background: tier.fill }}>
        <span className="relative box-border block h-full w-full rounded-full border-2 border-white bg-[#0A6DFE]">{children}</span>
      </span>
    </span>
  );
}
