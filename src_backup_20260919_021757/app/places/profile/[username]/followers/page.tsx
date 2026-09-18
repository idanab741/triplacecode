"use client";

import { use } from "react";
import { UserListPage } from "@/screens/places/UserListPage";

export default function FollowersPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  return (
    <UserListPage
      title="עוקבים"
      fetchUrl={`/api/social/profile/${username}/followers`}
      emptyMessage="אין עדיין עוקבים להצגה כאן."
    />
  );
}
