import { Skeleton } from "@/components/ui";
import { getTimeBasedGreeting } from "@/utils/greeting";

interface GreetingBlockProps {
  name: string | null;
  loading: boolean;
}

export function GreetingBlock({ name, loading }: GreetingBlockProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 pt-2 text-center">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  const greeting = getTimeBasedGreeting();

  return (
    <div className="px-6 pt-2 text-center">
      <h2 className="text-xl font-bold text-ink">
        {greeting}, {name || "אורח"}!
      </h2>
      <p className="mt-1 text-sm text-ink-secondary">הטיול הבא שלך מתחיל כאן</p>
    </div>
  );
}