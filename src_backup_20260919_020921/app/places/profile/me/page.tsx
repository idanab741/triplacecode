"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui";

export default function MyProfileRedirectPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    fetch("/api/social/profile/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile?.username) {
          router.replace(`/places/profile/${data.profile.username}`);
          return;
        }
        // *** תיקון (בקשה מפורשת - "למה זה קפץ עם מסך לא מעוצב?"): במקום
        // לחסום עם טופס "בחר שם משתמש" בלי הקשר/עיצוב, יוצרים אחד
        // אוטומטית בשקט (ensureUsername) - אפשר לשנות מאוחר יותר
        // ב-/places/settings אם ירצו.
        fetch("/api/social/username/auto", { method: "POST" })
          .then((r) => r.json())
          .then((data2) => {
            if (data2.username) router.replace(`/places/profile/${data2.username}`);
          });
      });
  }, [user, router]);

  return (
    <div className="p-6">
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
