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
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-44" />
      </div>
    );
  }

  const greeting = getTimeBasedGreeting();

  return (
<div className="-m1 px-6 text-center">
  
 <h2 className="text-3xl font-bold leading-tight text-ink">
  {greeting},{" "}
  <span style={{ color: "#166ede" }}>
    {name || "אורח"}!
  </span>
</h2>

<p className="mt0 text-[17px] font-medium text-ink-secondary">
  הטיול הבא שלך מתחיל כאן
</p>
    </div>
  );
}