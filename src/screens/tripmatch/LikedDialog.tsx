"use client";

import Image from "next/image";

interface LikedDialogProps {
  placeName: string;
  /** תמונת המקום שאהבו בפועל - מוצגת בעיגול הצף (במקום הקמע), כדי
   *  שהרגע ירגיש אישי ורלוונטי למה שבאמת נבחר. */
  placeImageUrl?: string;
  onContinue: () => void;
  /** "לא, סיימתי" - מסיימים את הסבב ועוברים לתוצאות (לא ניווט לפרטי מקום -
   *  זה בלבל, כי הכפתור השני כבר "כן, המשך [להחליק]"). */
  onFinish: () => void;
}

/** Dialog אחרי Like - שדרוג ויזואלי: תמונת ה-Hero הקבועה של TripMatch
 *  כרקע חגיגי מלא (במקום פס גרדיאנט שטוח), עם תמונת המקום שנאהב בפועל
 *  צפה בעיגול שחופף את התמונה מלמטה (במקום הקמע - כדי שהרגע ירגיש
 *  אישי ורלוונטי), ותג לב קטן שמסמן את הרגע. אותה פלטת צבעים/רדיוסים
 *  כמו שאר האפליקציה - רק יותר "מלהיב" ופחות שטוח. */
export function LikedDialog({ placeName, placeImageUrl, onContinue, onFinish }: LikedDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm">
      <div className="relative w-full max-w-sm overflow-hidden rounded-card bg-white pb-6 text-center shadow-soft">
        {/* תמונת ה-Hero הקבועה של TripMatch - רקע חגיגי אחיד (לא תמונת */}
        {/* המקום הספציפי - זו יושבת בעיגול למטה). גרדיאנט כהה עדין לקריאות */}
        {/* + נקודות "קונפטי" עדינות שמתלבשות על התמונה. */}
        <div className="relative h-40 w-full overflow-hidden">
          <Image src="/images/hero-tripmatch.png" alt="" fill priority className="object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 55%, rgba(24,119,242,0.25) 100%)" }}
          />
          <div
            className="absolute inset-0 opacity-40"
            style={{ backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)", backgroundSize: "18px 18px" }}
          />
          <span className="absolute right-6 top-5 text-xl animate-pulse">✨</span>
          <span className="absolute left-8 top-9 text-base animate-pulse" style={{ animationDelay: "0.4s" }}>
            ✨
          </span>
        </div>

        {/* עיגול התמונה - תמונת המקום שנאהב בפועל (לא הקמע), כדי שהרגע */}
        {/* ירגיש אישי ורלוונטי למה שבאמת נבחר. נופל חזרה לקמע Tripy רק */}
        {/* אם למקום הזה במקרה אין תמונה כלל. */}
        {/* *** תיקון: תמונות מקום מגיעות דרך /api/places/photo (פרוקסי ל-Google */}
        {/* Places), ו-next/image קורס עליהן ב-runtime - בדיוק כמו בשאר האפליקציה */}
        {/* (TripMatchCard, מסך התוצאות) אלה מוצגות עם <img> רגיל, לא next/image. */}
        <div className="relative -mt-10 flex justify-center">
          <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg">
            {placeImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={placeImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Image src="/images/tripmatch-liked-mascot.png" alt="" fill className="object-cover object-top" />
            )}
          </div>
          {/* תג לב קטן - מסמן את "רגע ה-Like" בפינת הקמע */}
          <div
            className="absolute -bottom-1 right-[calc(50%-40px)] flex h-7 w-7 animate-bounce items-center justify-center rounded-full border-2 border-white text-sm shadow-md"
            style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
          >
            ❤️
          </div>
        </div>

        <div className="px-6 pt-3">
          <p className="text-lg font-extrabold text-ink">{placeName} נוסף למועדפים! 🎉</p>
          <p className="mt-1.5 text-[13.5px] text-ink-secondary">האם תרצו להמשיך להחליק?</p>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onFinish}
              className="flex-1 rounded-pill bg-bg-secondary py-3 text-sm font-semibold text-ink transition active:scale-[0.97]"
            >
              לא, סיימתי
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="flex-1 rounded-pill py-3 text-sm font-semibold text-white shadow-soft transition active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              כן, המשך
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
