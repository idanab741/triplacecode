import { ComingSoon } from "@/components/ComingSoon";
import { MainBottomNav } from "@/components/MainBottomNav";

export default function CommunityPage() {
  return (
    <>
      <ComingSoon title="קהילה" message="כאן תוכלו להתחבר למטיילים אחרים ולשתף חוויות." />
      <MainBottomNav active="community" />
    </>
  );
}
