interface SkeletonProps {
  className?: string;
}

/** מלבן טעינה פועם, למניעת קפיצות עיצוב בזמן טעינת נתונים. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse rounded-card bg-bg-secondary ${className}`} />;
}
