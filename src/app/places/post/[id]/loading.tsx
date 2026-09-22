/** מוצג *מיד* בניווט לעמוד פוסט, בזמן שנטענים הנתונים (בלי מסך ריק). */
export default function PostLoading() {
  return (
    <div className="min-h-screen bg-white pb-28">
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="h-10 w-10 animate-pulse rounded-full bg-bg-secondary" />
        <div className="h-3 w-28 animate-pulse rounded bg-bg-secondary" />
      </div>
      <div className="mt-3 aspect-square w-full animate-pulse bg-bg-secondary" />
    </div>
  );
}
