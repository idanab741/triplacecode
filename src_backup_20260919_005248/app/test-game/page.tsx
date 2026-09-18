"use client";

import { LoadingGame } from "@/screens/trip-builder/LoadingGame";

/**
 * עמוד המשחק שלנו - נגיש ישירות מעמוד הבית (כרטיסיית "גלה עוד"), לא רק
 * בזמן בניית מסלול אמיתי.
 */
export default function GamePage() {
  return <LoadingGame statusText="RUNtrippy" />;
}
