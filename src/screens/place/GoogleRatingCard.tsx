import Image from "next/image";

interface GoogleRatingCardProps {
  rating: number;
  ratingCount: number | null;
  googleUrl: string;
}

/**
 * *** חדש (בקשה מפורשת - "דירוג גוגל, עם אפשרות להיכנס לדירוגי גוגל,
 * כמה דירגו בגוגל וציון מדורג... אחיד לכל העמודים"): קומפוננטה משותפת
 * לעמוד המקום הישן ולעמוד ה-TripAdd - קודם כל אחד הציג את זה קצת
 * אחרת (הישן: כפתור עם אימוג'י 🌐; TripAdd: שורה בתוך בלוק הדירוגים
 * העליון). מעכשיו אותה קומפוננטה בדיוק בשני המקומות - לוגו Google
 * אמיתי (כבר קיים ב-public/images, בשימוש גם ב-TripAddPlaceView),
 * קישור חיצוני בלבד ל-Google Maps (לא קריאת API), כמו קודם.
 */
export function GoogleRatingCard({ rating, ratingCount, googleUrl }: GoogleRatingCardProps) {
  return (
    <a
      href={googleUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-card border border-ink-secondary/15 bg-white px-4 py-3.5"
    >
      <div className="flex items-center gap-3">
        <Image src="/images/google-logo.png" alt="Google" width={200} height={70} className="h-5 w-auto object-contain" />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-ink">
            {rating.toFixed(1)} <span className="text-amber-500">★</span>
          </span>
          <span className="text-xs text-ink-secondary">
            {ratingCount != null ? `${ratingCount.toLocaleString()} דירוגים ב-Google` : "דירוגי Google"}
          </span>
        </div>
      </div>
      <span className="text-ink-secondary">›</span>
    </a>
  );
}
