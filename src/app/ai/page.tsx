import { ComingSoon } from "@/components/ComingSoon";
import { MainBottomNav } from "@/components/MainBottomNav";

export default function AiAssistantPage() {
  return (
    <>
      <ComingSoon title="עוזר ה-AI" message="בקרוב עוזר AI אישי יעזור לכם לתכנן את הטיול המושלם." />
      <MainBottomNav active="ai" />
    </>
  );
}
