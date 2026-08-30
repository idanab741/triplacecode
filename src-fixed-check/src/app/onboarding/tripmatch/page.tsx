"use client";

import { FeatureOnboardingScreen } from "@/screens/onboarding/FeatureOnboardingScreen";
import { Slide3TripMatch } from "@/screens/onboarding/slides/Slide3TripMatch";

export default function TripMatchOnboardingPage() {
  return <FeatureOnboardingScreen feature="tripmatch" destination="/tripmatch" Slide={Slide3TripMatch} />;
}