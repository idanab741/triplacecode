/** מוצג *מיד* בניווט לעמוד מקום, בזמן שהשרת שולף את הנתונים (בלי מסך ריק). */
export default function PlaceLoading() {
  return (
    <div className="min-h-screen bg-white pb-28">
      <div className="h-72 w-full animate-pulse bg-bg-secondary" />
      <div className="flex flex-col gap-5 px-5 pt-5">
        <div className="h-6 w-2/3 animate-pulse rounded bg-bg-secondary" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-bg-secondary" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-bg-secondary" />
      </div>
    </div>
  );
}
