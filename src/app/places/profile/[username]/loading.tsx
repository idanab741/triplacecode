import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { MainBottomNav } from "@/components/MainBottomNav";

/** מוצג *מיד* בניווט לפרופיל, בזמן שהשרת שולף את הנתונים: בר triplace + שלד של הקאבר והשם (בלי מסך ריק). */
export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <CollapsibleTopBar />
      <div className="-mt-8 aspect-square w-full animate-pulse bg-gradient-to-b from-[#e8eefc] to-[#f6f8fe]" />
      <div className="-mt-5 flex flex-col items-center gap-2 px-4">
        <div className="h-5 w-32 animate-pulse rounded bg-bg-secondary" />
        <div className="h-3.5 w-24 animate-pulse rounded bg-bg-secondary" />
      </div>
      <MainBottomNav active="profile" />
    </div>
  );
}
