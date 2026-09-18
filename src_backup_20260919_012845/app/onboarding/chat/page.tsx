"use client";

import { FeatureOnboardingScreen } from "@/screens/onboarding/FeatureOnboardingScreen";
import { Slide4Ai } from "@/screens/onboarding/slides/Slide4Ai";
import { Slide5Route } from "@/screens/onboarding/slides/Slide5Route";

/** Both existing Trip Building screens are shown once, before the AI chat. */
export default function ChatOnboardingPage() {
  return <FeatureOnboardingScreen feature="tripbuilding" destination="/ai" Slides={[Slide4Ai, Slide5Route]} />;
}
