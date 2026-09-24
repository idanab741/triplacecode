import type { ReactNode } from "react";
import Image from "next/image";
import { ChevronStartIcon } from "./icons";

/** גובה אחיד לשני הלוגואים. קובץ הלוגו של triplace כולל שוליים שקופים גדולים יותר משל Google,
 *  ולכן התיבה שלו גבוהה יותר - כך שהאותיות עצמן יוצאות באותו גובה. */
const GOOGLE_LOGO = "h-[18px] w-auto";
/** בשורת הדירוג האחת - מעט קטנים יותר, כדי ששני הצדדים ייכנסו בשורה אחת גם במסך צר. */
const ROW_GOOGLE_LOGO = "h-[16px] w-auto";
const ROW_TRIPLACE_LOGO = "h-[22px] w-auto";

function Star() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F5A623" d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.3 6.6L12 17l-5.9 3.4 1.3-6.6-4.9-4.5 6.6-.7L12 2.5z" />
    </svg>
  );
}

/**
 * *** בקשה מפורשת ("שורת הביקורות של triplace ו-google צריכות להיות באותה שורה! לא 2"):
 * כל תא הוא שורה אחת אופקית - לוגו, ציון, כוכב ומספר מדרגים זה לצד זה (קודם הלוגו ישב מעל
 * הציון, כך שכל צד התפצל לשתי שורות). שני התאים חולקים את אותה שורה עם קו מפריד ביניהם.
 */
function RatingCell({ logo, rating, count, emptyText }: { logo: ReactNode; rating: number | null; count: number | null; emptyText: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap py-1">
      <span className="flex h-[22px] shrink-0 items-center">{logo}</span>
      {rating != null ? (
        <span className="flex min-w-0 items-center gap-1">
          <span className="text-[15.5px] font-bold text-ink tabular-nums">{rating.toFixed(1)}</span>
          <Star />
          {count != null && count > 0 && <span className="truncate text-[12.5px] text-ink-secondary tabular-nums">({count.toLocaleString("he-IL")})</span>}
        </span>
      ) : (
        <span className="truncate text-[12.5px] text-ink-secondary">{emptyText}</span>
      )}
    </div>
  );
}

/** 4. דירוג Google | דירוג triplace - בשורה אחת, עם הלוגואים באותו גודל אופטי. */
export function AttractionRatingsSummary({
  googleRating,
  googleRatingCount,
  triplaceRating,
  triplaceRatingCount,
}: {
  googleRating: number | null;
  googleRatingCount: number | null;
  triplaceRating: number | null;
  triplaceRatingCount: number;
}) {
  return (
    <div className="mx-5 mt-4 flex items-center">
      <RatingCell
        logo={<Image src="/images/google-logo.png" alt="Google" width={200} height={70} className={ROW_GOOGLE_LOGO} />}
        rating={googleRating}
        count={googleRatingCount}
        emptyText="אין דירוג"
      />
      <span aria-hidden="true" className="h-6 w-px shrink-0 bg-black/[0.1]" />
      <RatingCell
        logo={<Image src="/images/triplace-logo-black.png" alt="triplace" width={174} height={53} className={ROW_TRIPLACE_LOGO} />}
        rating={triplaceRatingCount > 0 ? triplaceRating : null}
        count={triplaceRatingCount}
        emptyText="עוד אין דירוג"
      />
    </div>
  );
}

/** 13. קישור לדירוגי Google - הדירוג ומספר המדרגים, ולחיצה פותחת את המקום ב-Google Maps. */
export function GoogleReviewsLink({ rating, count, url }: { rating: number | null; count: number | null; url: string }) {
  return (
    <section className="px-5 pt-6">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3.5 rounded-2xl bg-[#F4F5F7] px-4 py-3.5 transition-colors active:bg-[#EBEDF0]"
      >
        <Image src="/images/google-logo.png" alt="Google" width={200} height={70} className={GOOGLE_LOGO} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">דירוגים ב-Google</span>
          <span className="flex items-center gap-1 text-[13px] text-ink-secondary">
            {rating != null ? (
              <>
                <span className="font-semibold text-ink tabular-nums">{rating.toFixed(1)}</span>
                <Star />
                {count != null && <span className="tabular-nums">· {count.toLocaleString("he-IL")} מדרגים</span>}
              </>
            ) : (
              "לכל הביקורות על המקום"
            )}
          </span>
        </span>
        <span className="shrink-0 text-ink-secondary">
          <ChevronStartIcon />
        </span>
      </a>
    </section>
  );
}
