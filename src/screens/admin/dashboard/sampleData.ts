/** נתוני דוגמה ל-Dashboard, בנויים באותה צורה בדיוק שנתונים אמיתיים
 *  יגיעו (מ-Supabase, כשיחוברו). כל פונקציה כאן היא "התפר" הברור להחלפה
 *  בשאילתה אמיתית - שם הפונקציה, סוג הקלט/פלט נשארים זהים. */

export interface DashboardStats {
  totalUsers: number;
  newUsersThisMonth: number;
  activeUsers: number;
  returningUsers: number;
  signupConversion: number;
  premiumConversion: number;
  tripsBuilt: number;
  tripsSaved: number;
  tripsShared: number;
  avgBuildTimeSeconds: number;
  retention30d: number;
  deltas: Record<string, number>;
}

export function getDashboardStats(): DashboardStats {
  // TODO: להחליף בשאילתת Supabase אמיתית מול טבלאות users / trips / sessions.
  return {
    totalUsers: 18420,
    newUsersThisMonth: 2140,
    activeUsers: 6310,
    returningUsers: 4120,
    signupConversion: 34.2,
    premiumConversion: 8.6,
    tripsBuilt: 9840,
    tripsSaved: 6210,
    tripsShared: 1480,
    avgBuildTimeSeconds: 94,
    retention30d: 41.5,
    deltas: {
      totalUsers: 12.4,
      newUsersThisMonth: 8.1,
      activeUsers: -3.2,
      tripsBuilt: 15.6,
      premiumConversion: 4.9,
      retention30d: 2.1,
    },
  };
}

const MONTHS = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];

export function getSignupsSeries() {
  // TODO: להחליף בשאילתה אמיתית - הרשמות מקובצות לפי חודש.
  return {
    labels: MONTHS,
    series: [
      { label: "הרשמות", color: "var(--admin-chart-1)", values: [820, 940, 1050, 990, 1180, 1340, 1290, 1410, 1560, 1680, 1920, 2140] },
      { label: "משתמשים פעילים", color: "var(--admin-chart-2)", values: [1400, 1520, 1680, 1750, 1890, 2100, 2250, 2400, 2680, 2950, 3280, 3610] },
    ],
  };
}

export function getTripsBuiltSeries() {
  // TODO: להחליף בשאילתה אמיתית - מסלולים שנבנו/נשמרו/שותפו לפי חודש.
  return {
    labels: MONTHS,
    series: [
      { label: "נבנו", color: "var(--admin-chart-1)", values: [420, 480, 510, 540, 610, 690, 720, 780, 840, 910, 980, 1040] },
      { label: "נשמרו", color: "var(--admin-chart-3)", values: [260, 300, 330, 350, 400, 450, 470, 510, 560, 600, 650, 690] },
    ],
  };
}

export function getTopCountries() {
  // TODO: להחליף בשאילתה אמיתית - פילוח מסלולים לפי מדינת יעד.
  return [
    { label: "יוון", value: 2140 },
    { label: "איטליה", value: 1820 },
    { label: "ספרד", value: 1540 },
    { label: "ישראל", value: 1310 },
    { label: "צרפת", value: 980 },
    { label: "פורטוגל", value: 760 },
  ];
}

export function getTopTripTypes() {
  return [
    { label: "טיול יומי", value: 3120 },
    { label: "חופשה בחו\"ל", value: 2640 },
    { label: "סופ\"ש זוגי", value: 1890 },
    { label: "טיול בטבע", value: 1240 },
    { label: "חיי לילה", value: 690 },
  ];
}

export interface AiInsight {
  id: string;
  tone: "success" | "warning" | "accent";
  title: string;
  description: string;
}

export function getAiInsights(): AiInsight[] {
  // TODO: להחליף בפלט אמיתי של מערכת ה-Learning כשתחובר.
  return [
    {
      id: "1",
      tone: "success",
      title: "עלייה של 22% במסלולים זוגיים",
      description: "משתמשים בגילאי 25-34 מגדילים משמעותית את השימוש בקטגוריית \"סופ\"ש זוגי\" בחודש האחרון.",
    },
    {
      id: "2",
      tone: "warning",
      title: "נטישה גבוהה בשלב בחירת מלון",
      description: "38% מהמשתמשים עוזבים את בניית המסלול בדיוק בשלב הצעת המלון - כדאי לבדוק את זרימת המסך.",
    },
    {
      id: "3",
      tone: "accent",
      title: "יוון ממשיכה להוביל",
      description: "יוון היא היעד הפופולרי ביותר לחודש שני ברציפות, עם דגש על האיים (מיקונוס, כרתים).",
    },
  ];
}
