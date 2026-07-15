export function DiscoverCard() {
  return (
  <section className="px-6">
    <h3 className="mb-3 text-lg font-semibold text-ink">
      גלה עוד
    </h3>

    <Link href={SLIDES[current].href} className="block">
      <Image
        src={SLIDES[current].image}
        alt={SLIDES[current].alt}
        width={1200}
        height={675}
        className="w-full rounded-3xl shadow-xl"
        priority
      />
    </Link>

    <div className="mt-4 flex justify-center gap-2">
      {SLIDES.map((_, index) => (
        <button
          key={index}
          onClick={() => setCurrent(index)}
          className={`h-2 rounded-full transition-all ${
            current === index
              ? "w-6 bg-blue-500"
              : "w-2 bg-blue-300"
          }`}
        />
      ))}
    </div>
  </section>
);
}