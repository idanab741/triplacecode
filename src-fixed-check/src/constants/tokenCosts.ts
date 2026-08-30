/**
 * עלויות הפעולות במטבע "טריפים" - קובץ בטוח לייבוא גם מ-client
 * components (לא מכיל שום קוד/סוד server-only, בניגוד ל-
 * services/tokens/tokenService.ts). services/tokens/tokenService.ts
 * מייבא ומייצא מחדש מכאן - כדי שהמספרים יוגדרו במקום אחד יחיד.
 */
export const MONTHLY_TOKEN_ALLOWANCE = 100;

export const TOKEN_COSTS = {
  trippy_ai_generation: 10,
  tripmatch_like: 5,
} as const;

export type TokenActionType = keyof typeof TOKEN_COSTS;
