import Image from "next/image";

/** אייקוני Places המשותפים לעמודי היצירה (פוסט / מקום) - במקום אימוג'ים גנריים (📍 🔍 📸).
 *  כולם בסגול של place's (--color-places-purple). */

const PURPLE = "var(--color-places-purple)";

/** מציג PNG שקוף בצבע אחד (mask) - כך אייקון הקובץ שלנו נצבע בסגול בלי ליצור קובץ חדש. */
function MaskIcon({ src, width, height, color = PURPLE }: { src: string; width: number; height: number; color?: string }) {
  const mask = `url(${src})`;
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0"
      style={{
        width,
        height,
        backgroundColor: color,
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

/** המצלמה של place's (places-camera-icon.png) - בסגול. */
export function PlacesCameraIcon({ size = 18 }: { size?: number }) {
  return <MaskIcon src="/images/places-camera-icon.png" width={size} height={Math.round(size * 0.9)} />;
}

/** זכוכית מגדלת - אותו SVG בדיוק כמו בשורת החיפוש של place's (PlacesTopBarCreate). */
export function PlacesSearchIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2" strokeLinecap="round" className="shrink-0" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** גלובוס = "אינטרנט" (רשת חברתית / אתר). */
export function PlacesGlobeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  );
}

/** "מקום" של place's - אותו places-menu-location.png של תפריט היצירה, בעיגול סגול בהיר. */
export function PlacesLocationIcon({ size = 36 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: "rgba(124,58,237,0.08)" }}
      aria-hidden="true"
    >
      <Image src="/images/places-menu-location.png" alt="" width={20} height={20} className="object-contain" />
    </span>
  );
}
