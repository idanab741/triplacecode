"use client";

import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { parseOpeningHoursForDay, minutesToTimeLabel } from "@/utils/openingHours";

/**
 * חלונית המקום שנפתחת מעל המפה (לחיצה על פין) - עוצבה מחדש לפי הבריף:
 * קומפקטית, RTL אמיתי, אך ורק אייקונים/נכסים קיימים (Icon component -
 * public/icons/, לוגו TRIPLACE הקיים, כוכב הדירוג הקיים מ-
 * TripLaceRatingSection). אייקון הקטגוריה מתקבל כ-prop (categoryIconSrc)
 * ולא ממופה כאן פנימית - כך שהקומפוננטה מתאימה גם לטקסונומיית
 * HomeQuickCategoryId (public/images/categories/*.png, כבר בשימוש ב-
 * HomeMap.tsx) וגם לכל טקסונומיה אחרת שכבר קיימת באפליקציה, בלי לצייר
 * שום אייקון חדש בעצמה.
 *
 * *** Waze / Google Maps / לוגו Google: לוגואים אמיתיים (לא מצוירים
 * מחדש) - סופקו ע"י המשתמש. Waze וGoogle Maps נטענים דרך אותו Icon
 * component הקיים בדיוק (public/icons/waze.png, public/icons/
 * google-maps.png - אותה מוסכמה כמו save/share הקיימים). לוגו Google
 * המלא (המילה "Google" הצבעונית, לא רק ה-"G") הוא public/images/
 * google-logo.png.
 */

function StarIcon({ size = 13 }: { size?: number }) {
  // *** אותו path/צבע בדיוק כמו ב-TripLaceRatingSection.tsx (StarRow) - לא אייקון חדש.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1.5">
      <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.3 6.6L12 17l-5.9 3.4 1.3-6.6-4.9-4.5 6.6-.7L12 2.5z" />
    </svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  // *** אותו path בדיוק כמו CloseIcon ב-PopupCard.tsx - לא אייקון חדש.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export interface PlaceMapPopupData {
  id: string;
  name: string;
  imageUrl: string | null;
  address: string | null;
  /** תווית הקטגוריה הראשית לתצוגה (כבר מתורגמת) - למשל "אטרקציות". */
  categoryLabel: string | null;
  /** נתיב לאייקון הקטגוריה הקיים (public/images/categories/... או כל נכס קיים אחר) - לא מצויר כאן, רק מוצג. */
  categoryIconSrc: string | null;
  /** קטגוריית משנה לתצוגה (למשל "בתי קפה") - שדה נפרד לגמרי מהקטגוריה הראשית. */
  subcategoryLabel: string | null;
  triplaceRating: number | null;
  googleRating: number | null;
  googleRatingCount: number | null;
  /** רמת מחיר 1-4 מגוגל (priceLevel) - לא מומצא מספר מדויק, רק ₪-₪₪₪₪. */
  priceLevel: number | null;
  /** נגישות לכיסא גלגלים מגוגל (accessibilityOptions.wheelchairAccessibleEntrance) - מוצג רק כשידוע וחיובי. */
  accessible: boolean | null;
  /** אותו מבנה שכבר קיים ב-place.opening_hours (מגוגל, בעברית) - openingHours.ts כבר יודע לפרסר. */
  openingHours: string[] | null;
  wazeUrl: string;
  googleMapsDirectionsUrl: string;
  googleReviewsUrl: string;
  saved: boolean;
}

interface PlaceMapPopupCardProps {
  place: PlaceMapPopupData;
  onClose: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  /** *** תוספת (בקשה מפורשת - "לוחצים על השם בחלונית -> מגיעים לעמוד
   *  האטרקציה"): אופציונלי בכוונה - קומפוננטה גנרית, לא כל מי שמשתמש
   *  בחלונית הזו חייב לתמוך בניווט לעמוד מקום. */
  onNameClick?: () => void;
}

export function PlaceMapPopupCard({ place, onClose, onToggleSave, onShare, onNameClick }: PlaceMapPopupCardProps) {
  const today = parseOpeningHoursForDay(place.openingHours, new Date().getDay());
  const isOpen = today === "closed" ? false : today ? isWithinToday(today) : null;
  const hoursLabel =
    today && today !== "closed" ? `${minutesToTimeLabel(today.openMinutes)}–${minutesToTimeLabel(today.closeMinutes)}` : null;

  return (
    <div dir="rtl" className="relative mx-auto w-[64vw] max-w-[294px]">
      <div className="overflow-hidden rounded-card bg-white shadow-soft">
        {/* דירוגים + סגירה. הלוגואים (triplace + Google) נשארים בגודל המקורי שלהם (h-5) בכוונה - לא
            מוקטנים עם שאר החלונית. תוצאה ישירה של זה: ברוחב הקטן החדש שני הלוגואים ביחד כבר לא
            נכנסים בשורה אחת - אז השורה עוברת ל-flex-wrap (שתי שורות) במקום להיחתך/לגלוש. כפתור
            הסגירה מקובע מוחלט בפינה השמאלית-עליונה (position absolute) כדי שהוא לא "יקפוץ" לשורה
            השנייה יחד עם שאר התוכן. */}
        <div className="relative flex flex-wrap items-center gap-x-1.5 gap-y-1 py-2 pr-3 pl-6">
          <div className="flex items-center gap-1">
            <Image src="/images/triplace-logo-black.png" alt="TripLace" width={62} height={19} className="h-5 w-auto object-contain" />
            {place.triplaceRating != null && (
              <span className="flex items-center gap-0.5 text-[9px] font-bold text-ink">
                <StarIcon size={9} />
                {place.triplaceRating.toFixed(1)}
              </span>
            )}
          </div>

          {place.googleRating != null && (
            <>
              <span className="h-3 w-px shrink-0 bg-ink-secondary/20" />
              <a
                href={place.googleReviewsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] font-semibold text-ink"
                aria-label="דירוגי Google - פתיחת ביקורות"
              >
                <Image src="/images/google-logo.png" alt="Google" width={200} height={70} className="h-5 w-auto object-contain" />
                <StarIcon size={9} />
                <span>{place.googleRating.toFixed(1)}</span>
                {place.googleRatingCount != null && (
                  <span className="font-normal text-ink-secondary">({place.googleRatingCount.toLocaleString()})</span>
                )}
              </a>
            </>
          )}

          {place.priceLevel != null && (
            <>
              <span className="h-3 w-px shrink-0 bg-ink-secondary/20" />
              <span className="text-[9px] font-semibold text-ink" aria-label="טווח מחירים">
                {"₪".repeat(Math.min(4, Math.max(1, place.priceLevel)))}
              </span>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="absolute left-1.5 top-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink"
          >
            <CloseIcon size={11} />
          </button>
        </div>

        {/* תמונת המקום - יחס רחב ונמוך בכוונה (לא 16:9) כדי שהחלונית כולה תישאר שטוחה */}
        {place.imageUrl && (
          <div className="px-3">
            <div className="relative aspect-[3/1] w-full overflow-hidden rounded-xl bg-bg-secondary">
              <Image src={place.imageUrl} alt={place.name} fill sizes="294px" className="object-cover" />
            </div>
          </div>
        )}

        <div className="px-3 pb-2 pt-1.5">
          {/* שם המקום - לחיץ (בקשה מפורשת) כניסה לעמוד האטרקציה המלא */}
          {onNameClick ? (
            <button
              type="button"
              onClick={onNameClick}
              className="block w-full truncate text-right text-[11px] font-extrabold leading-tight text-ink hover:underline"
            >
              {place.name}
            </button>
          ) : (
            <h3 className="truncate text-right text-[11px] font-extrabold leading-tight text-ink">{place.name}</h3>
          )}

          {/* כתובת + פתוח/סגור על אותה שורה - חוסך גובה */}
          <div className="mt-1 flex items-center justify-end gap-1.5 text-right text-[9px] leading-snug">
            {isOpen != null && (
              <span className="flex shrink-0 items-center gap-1">
                {hoursLabel && <span className="text-ink-secondary">{hoursLabel}</span>}
                <span className={`h-1 w-1 rounded-full ${isOpen ? "bg-[var(--color-category-green)]" : "bg-danger"}`} />
                <span className={`font-semibold ${isOpen ? "text-[var(--color-category-green)]" : "text-danger"}`}>
                  {isOpen ? "פתוח עכשיו" : "סגור עכשיו"}
                </span>
              </span>
            )}
            {isOpen != null && place.address && <span className="h-2.5 w-px shrink-0 bg-ink-secondary/20" />}
            {place.address && (
              <span className="flex min-w-0 items-center gap-1 truncate text-ink-secondary">
                <span className="truncate">{place.address}</span>
                <Icon name="location-pin" size={9} className="shrink-0 opacity-70" />
              </span>
            )}
          </div>

          <div className="my-1.5 h-px bg-ink-secondary/10" />

          {/* קטגוריה + תת-קטגוריה - האייקון מוביל בימין (RTL), הטקסט אחריו */}
          <div className="flex items-center justify-start gap-1.5">
            {place.categoryIconSrc && (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-secondary">
                <Image src={place.categoryIconSrc} alt="" width={13} height={13} className="h-[13px] w-[13px] object-contain" />
              </div>
            )}
            <div className="flex min-w-0 flex-col text-right">
              {place.categoryLabel && <span className="truncate text-[9px] font-semibold text-ink">{place.categoryLabel}</span>}
              {place.subcategoryLabel && (
                <span className="truncate text-[8px] text-ink-secondary">{place.subcategoryLabel}</span>
              )}
            </div>
            {/* נגישות - אותה מוסכמה בדיוק כמו TripMatchCard.tsx / admin/discovery (♿ נגיש) - מוצג רק כשידוע וחיובי, בלי "לא נגיש". */}
            {place.accessible === true && (
              <span className="mr-auto shrink-0 text-[9px] font-semibold text-ink">♿ נגיש</span>
            )}
          </div>

          <div className="my-1.5 h-px bg-ink-secondary/10" />

          {/* פעולות: Waze / Google Maps / שמירה / שיתוף - רק אייקונים, בלי כיתוב מתחת.
              כולם באותה קופסה בדיוק (24px) - בלי יוצאים מן הכלל.
              הכי ימני: גוגל מפות. אחריו: Waze. אחריו: שמירה. הכי שמאלי: שיתוף. */}
          <div className="flex items-stretch justify-between">
            <PopupAction href={place.googleMapsDirectionsUrl} label="ניווט בגוגל מפות">
              <Icon name="google-maps" size={24} />
            </PopupAction>

            <PopupAction href={place.wazeUrl} label="ניווט ב-Waze">
              <Icon name="waze" size={28} />
            </PopupAction>

            <PopupAction onClick={onToggleSave} label="שמירה">
              <Icon name={place.saved ? "save-active" : "save"} size={22} />
            </PopupAction>

            <PopupAction onClick={onShare} label="שיתוף">
              <Icon name="share" size={28} />
            </PopupAction>
          </div>
        </div>
      </div>

      {/* שפיץ קטן שמצביע על המיקום במפה */}
      <div className="mx-auto -mt-px h-2.5 w-2.5 rotate-45 rounded-[2px] bg-white shadow-soft" />
    </div>
  );
}

function PopupAction({
  href,
  onClick,
  label,
  boxSize = 24,
  children,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  /** גודל קופסת האייקון בפיקסלים - קבוע ואחיד לכל 4 האייקונים (24px). */
  boxSize?: number;
  children: React.ReactNode;
}) {
  const className =
    "flex flex-1 items-center justify-center rounded-xl py-1.5 text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink";

  const content = (
    <span className="flex items-center justify-center" style={{ width: boxSize, height: boxSize }}>
      {children}
    </span>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={className}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={className}>
      {content}
    </button>
  );
}

/** true אם השעה הנוכחית נמצאת בטווח הפתיחה של היום (תומך במעבר חצות, למשל בר עד 02:00). */
function isWithinToday(today: { openMinutes: number; closeMinutes: number }): boolean {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let closeMinutes = today.closeMinutes;
  if (closeMinutes <= today.openMinutes) closeMinutes += 24 * 60;
  return nowMinutes >= today.openMinutes && nowMinutes <= closeMinutes;
}
