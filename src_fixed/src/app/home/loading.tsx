import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { MainBottomNav } from "@/components/MainBottomNav";

/** מוצג *מיד* בניווט לדף הבית, בזמן שנטענים הנתונים: בר triplace + שלדי שורות (בלי מסך ריק). */
export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-bg pb-24">
      <CollapsibleTopBar loading />
      <div className="mt-4 flex flex-col gap-4 px-4">
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-bg-secondary" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-square w-full animate-pulse rounded-card bg-bg-secondary" />
          ))}
        </div>
      </div>
      <MainBottomNav active="home" />
    </div>
  );
}
