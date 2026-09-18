import { ComingSoonPage } from "@/screens/admin/shared/ComingSoonPage";

export default function AiEnginePage() {
  return (
    <ComingSoonPage
      title="מנוע ה-AI"
      description="שליטה בכל הפרמטרים והמשקלים של אלגוריתם בניית המסלול."
      points={[
        "משקלים: מרחק, מזג אוויר, שעות פתיחה, דירוגים, תקציב",
        "משקלים: Travel DNA, העדפות משתמש, פופולריות, צפיפות, עונתיות",
        "שינוי משקלים דרך ממשק גרפי - ללא צורך בשינוי קוד",
        "תצוגת השפעה - איך שינוי משקל משפיע על תוצאות לדוגמה",
      ]}
    />
  );
}
