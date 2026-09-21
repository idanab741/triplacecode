/**
 * עלויות הפעולות במטבע "טריפים" - קובץ בטוח לייבוא גם מ-client
 * components (לא מכיל שום קוד/סוד server-only, בניגוד ל-
 * services/tokens/tokenService.ts). services/tokens/tokenService.ts
 * מייבא ומייצא מחדש מכאן - כדי שהמספרים יוגדרו במקום אחד יחיד.
 */
export const MONTHLY_TOKEN_ALLOWANCE = 100;

/**
 * *** מבצע הרצה (בקשה מפורשת - "במיוחד להרצה: ללא הגבלת טריפים", "לבטל לגמרי את הטריפים... שיהיה כמו המבצע"):
 * כש-true, מערכת הטריפים "כבויה" - אף פעולה לא נחסמת ולא מחויבת (Trippy AI, TripMatch), והיתרה תמיד המלאה.
 * הכול עובר דרך tokenService, ולכן זה הדגל היחיד: כדי לחזור למערכת טריפים אמיתית - להחליף ל-false.
 */
export const UNLIMITED_TRIPS_PROMO = true;

export const TOKEN_COSTS = {
  trippy_ai_generation: 10,
  tripmatch_like: 5,
} as const;

export type TokenActionType = keyof typeof TOKEN_COSTS;
