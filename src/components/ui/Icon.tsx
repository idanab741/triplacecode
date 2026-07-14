import Image from "next/image";

interface IconProps {
  /** שם הקובץ (בלי סיומת) בתוך public/icons/ */
  name: string;
  size?: number;
  className?: string;
}

/** אייקון מתוך מערכת האייקונים האחידה של האתר (public/icons/). */
export function Icon({ name, size = 20, className = "" }: IconProps) {
  return (
    <Image
      src={`/icons/${name}.png`}
      alt=""
      width={size}
      height={size}
      className={className}
    />
  );
}
