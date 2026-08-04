"use client";

import { useFeatureOnboardingGuard } from "@/hooks/useFeatureOnboardingGuard";
import { TrippyConversation } from "@/screens/trip-builder/chat/TrippyConversation";

/** The AI tab remains one screen from the welcome message through the flow. */
export default function AiAssistantPage() {
  const { ready } = useFeatureOnboardingGuard("tripbuilding", "/onboarding/chat");
  return ready ? <TrippyConversation /> : null;
}
