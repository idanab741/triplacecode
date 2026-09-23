import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { PlacesHeaderRow } from "@/screens/places/PlacesHeaderRow";
import { MainBottomNav } from "@/components/MainBottomNav";

/** מוצג *מיד* בניווט לדף הבית (הפיד), בזמן שהעמוד הראשון נשלף בשרת. */
export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-places-bg pb-24">
      <CollapsibleTopBar headerRow={<PlacesHeaderRow />} />
      <div className="mt-3 h-[50px] bg-white" />
      <div className="flex flex-col gap-3 bg-white p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-48 w-full animate-pulse rounded-card bg-bg-secondary" />
        ))}
      </div>
      <MainBottomNav active="home" />
    </div>
  );
}
