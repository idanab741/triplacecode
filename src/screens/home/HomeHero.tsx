import { HomeHeader } from "./HomeHeader";

interface HomeHeroProps {
  avatarUrl?: string | null;
  loading: boolean;
}

/** אזור ה-Hero העליון: גרדיאנט עדין, לוגו, ומקום קבוע לתמונת הקמע שיתווסף בהמשך. */
export function HomeHero({ avatarUrl, loading }: HomeHeroProps) {
  return (
    <div className="relative h-64 w-full shrink-0 rounded-b-[40px] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary-start)_14%,var(--color-bg)),var(--color-bg))]">
      <HomeHeader avatarUrl={avatarUrl} loading={loading} />

      <div className="flex h-full flex-col items-center justify-center gap-1">
        <p className="text-xs font-medium tracking-wide text-ink-secondary">AI Powered by</p>
        <h1 className="bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] bg-clip-text text-3xl font-extrabold text-transparent">
          triplace
        </h1>
      </div>
    </div>
  );
}
