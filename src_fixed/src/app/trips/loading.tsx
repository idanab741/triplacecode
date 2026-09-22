import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { MainBottomNav } from "@/components/MainBottomNav";

/** מוצג *מיד* בניווט לעמוד "הטיולים שלי", בזמן שנטענים הנתונים (בלי מסך ריק). */
export default function TripsLoading() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <CollapsibleTopBar />
      <div className="flex flex-col gap-3 px-4 pt-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 w-full animate-pulse rounded-card bg-bg-secondary" />
        ))}
      </div>
      <MainBottomNav active="profile" />
    </div>
  );
}
