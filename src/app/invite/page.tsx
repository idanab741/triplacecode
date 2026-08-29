"use client";

import { useRouter } from "next/navigation";
import { Screen } from "@/components/ui";
import { SimpleAppHeader } from "@/screens/layout/SimpleAppHeader";
import { MainBottomNav } from "@/components/MainBottomNav";
import { InviteFriendsCard } from "@/components/invite/InviteFriendsCard";

export default function InvitePage() {
  const router = useRouter();

  return (
    <Screen withBottomNavSpacing className="!bg-bg !px-0 !pt-0">
      <SimpleAppHeader onBack={() => router.push("/profile")} title="הזמן חברים" />

      <div className="mx-auto max-w-xl px-5 pt-5">
        <InviteFriendsCard />
      </div>

      <MainBottomNav active="profile" />
    </Screen>
  );
}
