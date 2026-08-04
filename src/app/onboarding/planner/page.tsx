"use client";

import { FeatureOnboardingScreen } from "@/screens/onboarding/FeatureOnboardingScreen";
import { Slide5Route } from "@/screens/onboarding/slides/Slide5Route";

export default function PlannerOnboardingPage() {
  return <FeatureOnboardingScreen feature="planner" destination="/trip-builder/day-trip/result" Slide={Slide5Route} />;
}