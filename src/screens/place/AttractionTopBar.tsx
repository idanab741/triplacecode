"use client";

import { HomeHeader } from "@/screens/home/HomeHeader";

interface AttractionTopBarProps {
  backHref?: string;
}

/** בר עליון של עמודי מקום/אטרקציה: חזור + לוגו + פעמון (HomeHeader עצמו, בלי שכפול) - עכשיו כמסגרת זכוכית שקופה מעל התמונה. */
export function AttractionTopBar({ backHref }: AttractionTopBarProps) {
  return (
    // *** שינוי (בקשה מפורשת - "במקום התכלת - מסגרת שקופה, לא בפוקוס"): במקום הבר התכלת
    // הסולידי - זכוכית חלבית שקופה (backdrop-blur) שיושבת *על* תמונת ה-HERO. העמוד
    // האב חייב להיות position:relative והתמונה מתחילה מראש העמוד (בלי מרווח שלילי).
    <div
      className="absolute inset-x-0 top-0 z-10 rounded-b-[32px] border-b border-white/30 pb-4 backdrop-blur-xl backdrop-saturate-150"
      style={{ background: "rgba(255, 255, 255, 0.14)", WebkitBackdropFilter: "blur(20px) saturate(1.5)" }}
    >
      {/* צל עדין מאחורי הלוגו הלבן, כדי שיישאר קריא גם על תמונה בהירה */}
      <div style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.35))" }}>
        <HomeHeader
          loading={false}
          logoTone="white"
          onBack={() => {
            if (backHref) {
              window.location.href = backHref;
            } else {
              window.history.back();
            }
          }}
        />
      </div>
    </div>
  );
}
