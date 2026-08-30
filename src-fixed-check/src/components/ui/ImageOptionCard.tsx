import Image from "next/image";

interface ImageOptionCardProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  imageSrc?: string;
  /** יחס רוחב-גובה - ברירת מחדל ריבוע (1/1). לתמונות אחרות (כמו 555x369)
   *  אפשר להעביר "555/369" כדי לשמור על הפרופורציה המקורית בלי חיתוך/עיוות. */
  aspectRatio?: string;
}

/**
 * כרטיס בחירה עם תמונת רקע - שדרוג ויזואלי לצ'יפים השטוחים הישנים.
 * תמונה מלאה + גרדיאנט כהה מלמטה לקריאות הטקסט, ומצב "נבחר" עם מסגרת
 * גרדיאנט המותג + תג ✓ בפינה, כדי שהבחירה תהיה ברורה גם בלי טקסט צבעוני.
 * אם עדיין אין תמונה לאופציה הזו (imageSrc לא סופק) - מוצג placeholder
 * עדין באותו יחס-גובה, כדי שהרשת תישאר אחידה עד שתתווסף תמונה אמיתית.
 */
export function ImageOptionCard({ selected, onClick, label, imageSrc, aspectRatio = "1 / 1" }: ImageOptionCardProps) {
    return (
    <button
      type="button"
      onClick={onClick}
  className="group relative w-full overflow-hidden rounded-card transition active:scale-95"
      style={{
        aspectRatio,
        boxShadow: selected ? "0 8px 20px -4px rgba(24,119,242,0.35)" : "0 2px 8px rgba(16,24,40,0.1)",
      }}
    >
      {imageSrc ? (
        <>
          <Image
            src={imageSrc}
            alt=""
            fill
            sizes="(max-width: 480px) 30vw, 140px"
            className="object-cover transition duration-300 group-active:scale-105"
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0) 75%)",
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center p-2"
          style={{ background: "linear-gradient(135deg, rgba(74,158,255,0.16), rgba(27,111,232,0.24))" }}
        >
          <span className="text-center text-[11px] font-semibold leading-tight text-ink">{label}</span>
        </div>
      )}
      {selected && (
        <div
          className="absolute inset-0 rounded-card"
          style={{ boxShadow: "inset 0 0 0 3px var(--color-primary-end)" }}
        />
      )}
      {imageSrc && (
        <span className="absolute inset-x-1.5 bottom-1.5 text-right text-[11px] font-semibold leading-tight text-white drop-shadow-sm">
          {label}
        </span>
      )}
    </button>
  );
}
