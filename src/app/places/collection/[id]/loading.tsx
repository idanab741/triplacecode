/** מוצג *מיד* בניווט לעמוד אוסף, בזמן שנטענים הנתונים (בלי מסך ריק). */
export default function CollectionLoading() {
  return (
    <div className="min-h-screen bg-white pb-28">
      <div className="h-48 w-full animate-pulse bg-bg-secondary" />
      <div className="flex flex-col gap-4 px-5 pt-5">
        <div className="h-6 w-1/2 animate-pulse rounded bg-bg-secondary" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-square w-full animate-pulse rounded-xl bg-bg-secondary" />
          ))}
        </div>
      </div>
    </div>
  );
}
