export interface NavItem {
  href: string;
  label: string;
  icon: string; // emoji-as-icon, kept minimal/monochrome via CSS - no icon library dependency
  status: "ready" | "soon";
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** מבנה הניווט המלא של מערכת האדמין, לפי המפרט. כל הפריטים מופיעים כבר
 *  עכשיו (כדי שהניווט "ירגיש שלם") - "ready" מוביל למסך בנוי, "soon" מוביל
 *  למסך "בקרוב" מעוצב עם הסבר קצר על מה יהיה שם. */
export const ADMIN_NAV: NavGroup[] = [
  {
    title: "סקירה כללית",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: "◱", status: "ready" },
      { href: "/admin/analytics", label: "אנליטיקות", icon: "◫", status: "soon" },
      { href: "/admin/learning", label: "מערכת Learning", icon: "◈", status: "soon" },
    ],
  },
  {
    title: "משתמשים",
    items: [
      { href: "/admin/users", label: "כל המשתמשים", icon: "◐", status: "ready" },
      { href: "/admin/permissions", label: "הרשאות וצוות", icon: "◑", status: "soon" },
    ],
  },
  {
    title: "תוכן",
    items: [
      { href: "/admin/places", label: "מקומות ואטרקציות", icon: "◆", status: "ready" },
      { href: "/admin/destinations", label: "יעדים ומדינות", icon: "◇", status: "ready" },
      { href: "/admin/tags", label: "מערכת תגיות", icon: "◉", status: "soon" },
      { href: "/admin/media", label: "ספריית מדיה", icon: "▣", status: "soon" },
      { href: "/admin/workflow", label: "Workflow ואישורים", icon: "◧", status: "soon" },
    ],
  },
  {
    title: "מסלולים ופיצ'רים",
    items: [
      { href: "/admin/trip-types", label: "סוגי טיולים", icon: "◫", status: "soon" },
      { href: "/admin/routes", label: "מסלולים מוכנים", icon: "◭", status: "soon" },
      { href: "/admin/tripmatch", label: "ניהול TripMatch", icon: "◒", status: "soon" },
      { href: "/admin/hot-destinations", label: "יעדים חמים", icon: "◓", status: "soon" },
      { href: "/admin/ai-engine", label: "מנוע ה-AI", icon: "◍", status: "soon" },
    ],
  },
  {
    title: "מערכת",
    items: [{ href: "/admin/notifications", label: "התראות מערכת", icon: "◔", status: "soon" }],
  },
];

export const ADMIN_NAV_FLAT = ADMIN_NAV.flatMap((g) => g.items);
