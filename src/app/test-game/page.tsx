"use client";

import { LoadingGame } from "@/screens/trip-builder/LoadingGame";

/**
 * עמוד בדיקה בלבד למשחק ההמתנה - מציג אותו ישירות, בלי לעבור שאלון שלם.
 * לא חלק מהזרימה האמיתית של האפליקציה, רק כלי פיתוח נוח.
 */
export default function TestGamePage() {
  return <LoadingGame statusText="בונים לכם את החופשה... (מסך בדיקה)" />;
}
