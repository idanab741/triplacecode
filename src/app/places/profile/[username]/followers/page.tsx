"use client";

import { use } from "react";
import { UserListPage } from "@/screens/places/UserListPage";

export default function FollowersPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  return <UserListPage username={username} initialTab="followers" />;
}
