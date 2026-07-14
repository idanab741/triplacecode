/** אזור ה-Hero: תמונת הקמע והלוגו. */
export function HomeHero() {
  return (
    <div
      className="relative w-full shrink-0"
      style={{
        backgroundColor: "#e5e6f4",
        aspectRatio: "4881 / 3377",
      }}
    >
      <img
        src="/images/home-hero.png"
        alt="triplace - AI Powered by"
        className="block h-auto w-full"
      />
    </div>
  );
}