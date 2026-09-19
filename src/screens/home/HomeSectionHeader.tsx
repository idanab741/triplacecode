import Image from "next/image";

interface HomeSectionHeaderProps {
  /** נתיב לאייקון העגול (public/images/home). */
  iconSrc: string;
  title: string;
  /** לוגו-טקסט שמופיע מיד אחרי הכותרת (למשל "גלה עוד ב-" + לוגו triplace). */
  titleLogoSrc?: string;
  /** קישור/פעולה בקצה הנגדי (למשל "לכל הטיולים") - אופציונלי. */
  actionLabel?: string;
  onAction?: () => void;
}

/** כותרת קטע בעמוד הבית: אייקון עגול תלת-ממדי + כותרת, ופעולה בקצה הנגדי. */
export function HomeSectionHeader({ iconSrc, title, titleLogoSrc, actionLabel, onAction }: HomeSectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5">
      <div className="flex items-center gap-2.5">
        <Image src={iconSrc} alt="" width={44} height={44} className="h-11 w-11 shrink-0 object-contain" />
        <h3 className="flex items-center gap-1.5 text-[19px] font-extrabold tracking-tight text-ink">
          {title}
          {titleLogoSrc && <Image src={titleLogoSrc} alt="triplace" width={110} height={34} className="h-[22px] w-auto object-contain" />}
        </h3>
      </div>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="text-sm font-medium text-accent">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
