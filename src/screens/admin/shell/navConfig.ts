import type { IconName } from "@/screens/admin/kit/Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** מפתח למונה חי בתפריט (ר' /api/admin/insights/badges) */
  badge?: "support" | "submissions";
  keywords?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const ADMIN_NAV: NavGroup[] = [
  {
    title: "סקירה",
    items: [
      { href: "/admin/dashboard", label: "מרכז שליטה", icon: "dashboard", keywords: "dashboard דשבורד ראשי" },
      { href: "/admin/health", label: "בריאות המערכת", icon: "health", keywords: "health בעיות תקלות איכות נתונים" },
      { href: "/admin/reports", label: "דוחות וייצוא", icon: "download", keywords: "reports export excel csv ייצוא דוח אקסל" },
    ],
  },
  {
    title: "צמיחה ושימוש",
    items: [
      { href: "/admin/users", label: "משתמשים", icon: "users", keywords: "users לקוחות" },
      { href: "/admin/products", label: "מוצרים ו-AI", icon: "products", keywords: "tripmatch trippy trip builder טוקנים טריפים" },
      { href: "/admin/community", label: "קהילה ומודרציה", icon: "community", badge: "submissions", keywords: "social פוסטים ביקורות הצעות tripadd" },
    ],
  },
  {
    title: "תוכן",
    items: [
      { href: "/admin/content", label: "מלאי תוכן", icon: "content", keywords: "content inventory" },
      { href: "/admin/places", label: "מקומות ואטרקציות", icon: "place", keywords: "places" },
      { href: "/admin/place-console", label: "קונסולת סוגי טיול", icon: "route", keywords: "place console" },
      { href: "/admin/discovery", label: "AI Discovery", icon: "sparkles", keywords: "discovery jobs" },
      { href: "/admin/destinations", label: "יעדים ומדינות", icon: "globe", keywords: "destinations" },
      { href: "/admin/taxonomy", label: "טקסונומיה", icon: "tag", keywords: "taxonomy" },
      { href: "/admin/place-type-fields", label: "שדות לפי סוג מקום", icon: "sliders", keywords: "fields" },
      { href: "/admin/places-archive", label: "ארכיון מקומות", icon: "archive", keywords: "legacy archive" },
    ],
  },
  {
    title: "תפעול",
    items: [
      { href: "/admin/support", label: "שירות לקוחות", icon: "support", badge: "support", keywords: "support פניות" },
      { href: "/admin/notifications", label: "התראות מערכת", icon: "bell", keywords: "notifications" },
    ],
  },
];

export const ADMIN_NAV_FLAT = ADMIN_NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));

export function findNavItem(pathname: string | null) {
  if (!pathname) return undefined;
  return [...ADMIN_NAV_FLAT].sort((a, b) => b.href.length - a.href.length).find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
}
