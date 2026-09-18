"use client";

import { use } from "react";
import { UserListPage } from "@/screens/places/UserListPage";

export default function FollowingPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  return (
    <UserListPage
      title="עוקב אחריהם"
      fetchUrl={`/api/social/profile/${username}/following`}
      emptyMessage="עדיין לא עוקב אחרי אף אחד."
    />
  );
}
