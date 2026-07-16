import { NextResponse } from "next/server";
import { callClaude } from "@/services/ai/claudeService";

/**
 * TEMPORARY DEBUG ENDPOINT — נועד לבדוק אם callClaude עובד בפרודקשן, ואם
 * לא, בדיוק למה. תמחקי את הקובץ הזה (ואת התיקייה debug-claude) אחרי
 * שסיימנו לאבחן.
 */
export async function GET() {
  const result = await callClaude("Say hello in exactly one word.", 50);
  return NextResponse.json(result);
}
