import { redirect } from "next/navigation";

/** Legacy URL: Trip Building onboarding now always starts from the AI tab. */
export default function PlannerOnboardingPage() {
  redirect("/ai");
}
