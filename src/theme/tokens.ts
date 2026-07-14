/**
 * Design tokens עבור TRIPLACE.
 *
 * זהו מקור האמת היחיד לצבעים, רדיוסים, צללים וריווחים בפרויקט.
 * הערכים כאן מוגדרים גם כמשתני CSS (ראו src/theme/tokens.css) כדי
 * שיהיה אפשר להשתמש בהם דרך מחלקות Tailwind (למשל bg-bg-secondary).
 * קובץ זה משמש כשצריך לגשת לערכים ישירות מקוד TypeScript.
 */

export const colors = {
  primaryStart: "#4A9EFF",
  primaryEnd: "#1B6FE8",
  bg: "#FCFAFC",
  bgSecondary: "#F5F7FA",
  ink: "#1A1A2E",
  inkSecondary: "#8A8FA3",
  accent: "#4A9EFF",
  danger: "#E5484D",
  categoryOrange: "#FF9F4A",
  categoryPink: "#FF6B9D",
  categoryPurple: "#9F7BFF",
  categoryGreen: "#3EC28F",
} as const;

export const radius = {
  card: "20px",
  pill: "999px",
} as const;

export const shadow = {
  soft: "0 8px 24px -6px rgba(26, 26, 46, 0.12), 0 2px 8px -2px rgba(26, 26, 46, 0.06)",
} as const;

export const gradients = {
  primary: `linear-gradient(135deg, ${colors.primaryStart}, ${colors.primaryEnd})`,
} as const;
