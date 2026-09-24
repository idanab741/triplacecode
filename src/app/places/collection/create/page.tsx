"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { CREATE_INK } from "@/screens/create/CreateUi";
import { MainBottomNav } from "@/components/MainBottomNav";
import { CollectionForm } from "@/screens/collections/CollectionForm";
import type { CollectionType } from "@/services/social/collectionTypes";

/** "יצירת אוסף" - אחרי שבחרו "מה תרצו לאסוף?" (?type=places|trips). הסוג נקבע כאן ולא ניתן לערבב.
 *  *** תיקון (בקשה מפורשת - "הכל אמור להיות לבן! רק הפופאפ אמור להיות שחור, וגם זה רק
 *  בהעלאה דרך עמוד התוכן"): העמוד עצמו (בר עליון, רקע) תמיד לבן/סגול רגיל, בלי קשר למקור
 *  ההגעה. רק ?origin=content מסומן (dark) ומועבר הלאה ל-CollectionForm, כדי שפופאפ "מה
 *  תרצו להוסיף?" בלבד ייפתח שחור - שום דבר אחר בעמוד לא משתנה.
 *  *** תיקון נוסף (בקשה מפורשת - "יש חלק ריק למטה, צריך שיהיה שם בר תחתון"): לעמוד הזה לא
 *  היה בכלל בר תחתון (שלא כמו שאר עמודי place's) - נוסף MainBottomNav רגיל (אור, כמו בעמוד
 *  place's עצמו) בתחתית העמוד, עם ריווח תחתון תואם כדי שכפתור "פרסום האוסף" לא ייחסם. */
function CreateCollectionContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const type: CollectionType | null = typeParam === "places" || typeParam === "trips" ? typeParam : null;
  const dark = searchParams.get("origin") === "content";

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!type) router.replace("/home");
  }, [type, router]);

  if (authLoading || !user || !type) {
    return (
      <div className="min-h-screen bg-white" style={CREATE_INK}>
        <HomeStatusBarTint />
        <CollapsibleTopBar onBack={() => router.back()} />
        <div className="mx-auto max-w-xl px-5 pt-4">
          <Skeleton className="mb-2 h-8 w-44" />
          <Skeleton className="mb-6 h-4 w-64" />
          <Skeleton className="mb-6 h-12 w-full" />
          <Skeleton className="aspect-[16/9] w-full" />
        </div>
        <MainBottomNav active="content" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={CREATE_INK}>
      {/* *** עיצוב מחדש: הבר העליון של triplace (עם חזור) במקום הבר הסגול של place's. */}
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => router.back()} />
      <div className="pb-24">
        <CollectionForm mode="create" type={type} dark={dark} />
      </div>
      <MainBottomNav active="content" />
    </div>
  );
}

export default function CreateCollectionPage() {
  return (
    <Suspense>
      <CreateCollectionContent />
    </Suspense>
  );
}
