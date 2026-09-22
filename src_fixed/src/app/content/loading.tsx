import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { MainBottomNav } from "@/components/MainBottomNav";

/** מוצג *מיד* בניווט לטאב "תוכן", בזמן שנטענים הנתונים (בלי מסך ריק). */
export default function ContentLoading() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <CollapsibleTopBar />
      <div className="mx-auto mt-6 flex max-w-sm flex-col items-center gap-4 px-4">
        <div className="h-6 w-56 animate-pulse rounded bg-bg-secondary" />
        <div className="h-11 w-full animate-pulse rounded-full bg-bg-secondary" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-bg-secondary" />
        <div className="aspect-square w-full animate-pulse rounded-2xl bg-bg-secondary" />
      </div>
      <MainBottomNav active="content" tone="dark" />
    </div>
  );
}
