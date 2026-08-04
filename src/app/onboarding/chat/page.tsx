import { FeatureOnboardingScreen } from "@/screens/onboarding/FeatureOnboardingScreen";
import { Slide4Ai } from "@/screens/onboarding/slides/Slide4Ai";

/** יעד ברירת המחדל הוא /trip-builder/day-trip - סוג הטיול הנפוץ ביותר.
 *  אם רוצים שההסבר הזה יופיע גם לפני סוגי טיול אחרים (weekend, romantic-date
 *  וכו') - אפשר להעביר יעד דרך query param, או לשכפל את העמוד הזה. */
export default function ChatOnboardingPage() {
  return <FeatureOnboardingScreen feature="chat" destination="/trip-builder/day-trip" Slide={Slide4Ai} />;
}
