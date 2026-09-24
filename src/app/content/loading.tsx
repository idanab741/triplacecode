import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { MainBottomNav } from "@/components/MainBottomNav";

/** מוצג *מיד* בניווט לטאב "תוכן", בזמן שנטען העמוד.
 *  *** תיקון: היה על רקע לבן - עם לוגו לבן (בלתי נראה) והבהוב לבן לפני העמוד השחור. עכשיו שחור,
 *  באותו מבנה כמו העמוד עצמו (כותרת, דמות, 4 ריבועים). */
export default function ContentLoading() {
  return (
    <div className="min-h-screen bg-black pb-24">
      <CollapsibleTopBar logoTone="white" />
      <div className="mx-auto mt-2 flex max-w-sm flex-col items-center px-6">
        <div className="h-7 w-44 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-2 h-7 w-52 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-3 h-4 w-60 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-6 aspect-[720/492] w-[88%]" />
        <div className="grid w-full grid-cols-2 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[150px] animate-pulse rounded-[22px] bg-[#141416]" />
          ))}
        </div>
      </div>
      <MainBottomNav active="content" tone="dark" />
    </div>
  );
}
