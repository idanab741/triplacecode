/** אזור ה-Hero: תמונת הקמע והלוגו. ה-header יושב מעליו כרכיב נפרד, על הרקע האפור. */
export function HomeHero() {
  return (
    <div className="relative w-full shrink-0 overflow-hidden" style={{ backgroundColor: "#e5e6f4", aspectRatio: "4881 / 3377" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/home-hero.png"
        alt="triplace - AI Powered by"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}