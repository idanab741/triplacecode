import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { MainBottomNav } from "@/components/MainBottomNav";

/** מוצג *מיד* בניווט לעמוד היומן, בזמן שנטענים הנתונים (בלי מסך ריק). */
export default function CalendarLoading() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <CollapsibleTopBar />
      <div className="px-4 pt-4">
        <div className="h-72 w-full animate-pulse rounded-card bg-bg-secondary" />
      </div>
      <MainBottomNav active="profile" />
    </div>
  );
}
