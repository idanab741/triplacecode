import type { ReactNode } from "react";
import Image from "next/image";

interface ImageOptionRowProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  imageSrc?: string;
  /** תוכן חופשי (למשל SVG) שמוצג במקום imageSrc, כשאין קובץ תמונה
   *  מתאים לקטגוריה (שדה תוסף - לא משפיע על שום קריאה קיימת). */
  icon?: ReactNode;
  /** רוחב/גובה עיגול התמונה בפיקסלים. שווים = עיגול מושלם (ברירת
   *  מחדל 28/28). imageWidth > imageHeight = צורת "אליפסה"/גלולה
   *  מוארכת, שנותנת יותר מקום לתמונה המקורית להיכנס בלי חיתוך קיצוני. */
  imageWidth?: number;
  imageHeight?: number;
  /** true = שורה מלאה ברוחב, פריט אחד בכל שורה. false (ברירת מחדל) =
   *  צ'יפ שמתאים את עצמו לתוכן ונשבר לשורות (כמו קבוצת Chip רגילה). */
  fullWidth?: boolean;
  /** גודל הפונט של הכיתוב בפיקסלים (ברירת מחדל 13.5) - להקטנה בפריסות
   *  צפופות (כמו רשת 2 בשורה) כדי לצמצם קיצוץ בטקסטים ארוכים. */
  textSize?: number;
  /** גרדיאנט מותאם למצב selected (שדה תוסף) - ברירת המחדל היא הגרדיאנט
   *  הכחול הקיים בדיוק כמו שהיה, כדי לא לשנות שום מסך קיים. */
  selectedGradient?: string;
}

/** צ'יפ בחירה בסגנון Chip הרגיל, עם תמונה קטנה בתוך הצ'יפ (בצד ימין,
 *  לפני הכיתוב) - לרשימות שבהן רוצים רמז ויזואלי בלי אריח תמונה גדול. */
export function ImageOptionRow({
  selected,
  onClick,
  label,
  imageSrc,
  icon,
  imageWidth = 28,
  imageHeight = 28,
  fullWidth = false,
  textSize = 13.5,
  selectedGradient = "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))",
}: ImageOptionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-pill py-2 pe-4 ps-1.5 font-medium transition active:scale-95 ${
        fullWidth ? "w-full" : ""
      } ${selected ? "text-white" : "bg-white text-ink"}`}
      style={{
        fontSize: textSize,
        ...(selected
          ? { background: selectedGradient, boxShadow: "0 4px 12px rgba(24,119,242,0.28)" }
          : { boxShadow: "0 2px 8px rgba(16,24,40,0.08)" }),
      }}
    >
      <span
        className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-secondary"
        style={{ height: imageHeight, width: imageWidth }}
      >
        {icon ? icon : imageSrc && <Image src={imageSrc} alt="" fill sizes={`${Math.max(imageWidth, imageHeight)}px`} className="object-cover" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
