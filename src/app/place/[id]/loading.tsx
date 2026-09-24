/** מוצג *מיד* בניווט לעמוד אטרקציה - באותו מבנה כמו העמוד האחיד (בר, תמונה, כפתורים, דירוגים, שם). */
export default function PlaceLoading() {
  return (
    <div className="min-h-screen bg-white pb-28">
      <div className="aspect-[4/3] w-full animate-pulse bg-[#EFF1F4]" />
      <div className="flex gap-2.5 px-5 pt-4">
        <div className="h-11 flex-1 animate-pulse rounded-xl bg-[#EFF1F4]" />
        <div className="h-11 flex-1 animate-pulse rounded-xl bg-[#EFF1F4]" />
      </div>
      <div className="mx-5 mt-4 h-14 animate-pulse rounded-xl bg-[#F4F5F7]" />
      <div className="mx-5 mt-5 h-7 w-2/3 animate-pulse rounded-lg bg-[#EFF1F4]" />
      <div className="mx-5 mt-6 h-5 w-24 animate-pulse rounded bg-[#EFF1F4]" />
      <div className="mx-5 mt-3 h-4 w-3/4 animate-pulse rounded bg-[#F4F5F7]" />
    </div>
  );
}
