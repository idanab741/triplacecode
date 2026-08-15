import { ComingSoonPage } from "@/screens/admin/shared/ComingSoonPage";

export default function MediaPage() {
  return (
    <ComingSoonPage
      title="ספריית מדיה"
      description="ספרייה מרכזית לכל התמונות, הסרטונים והאייקונים של האפליקציה."
      points={[
        "חיפוש ותיוג לפי שימוש",
        "החלפה מרוכזת של תמונה בכל המקומות שבהם היא מופיעה",
        "גרסאות וחיתוך תמונות",
        "אופטימיזציה אוטומטית לגדלים שונים",
      ]}
    />
  );
}
