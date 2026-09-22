/** מוצג *מיד* בניווט לעמוד טיול, בזמן שנטענים הנתונים (בלי מסך ריק). */
export default function TripLoading() {
  return (
    <div className="min-h-screen bg-white pb-28">
      <div className="h-64 w-full animate-pulse bg-bg-secondary" />
      <div className="flex flex-col gap-4 px-5 pt-5">
        <div className="h-6 w-2/3 animate-pulse rounded bg-bg-secondary" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-bg-secondary" />
        ))}
      </div>
    </div>
  );
}
