"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen, Skeleton, BackButton, SwipeToDeleteRow } from "@/components/ui";
import { SaveTripIconButton } from "@/screens/trip-builder/SaveTripIconButton";
import { MainBottomNav } from "@/components/MainBottomNav";
import { TRIPMATCH_CATEGORY_BUCKETS } from "@/locales/he/tripBuilder";
import dynamic from "next/dynamic";
import { getCategoryLabel } from "@/utils/categoryLabels";

// המפה (Leaflet) משתמשת ב-window/DOM - חייבת להיטען רק בצד הלקוח, לא ב-SSR
const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), {
  ssr: false,
});

// אותה רשימה בדיוק כמו במסך התוצאות החי (תואם CONTINUE_CATEGORY_VALUES
// ב-app/tripmatch/page.tsx) - "טבע" לא נכלל במחזור הזה.
const CONTINUE_CATEGORY_VALUES: string[] = ["nightlife", "restaurants", "attractions"];

interface SavedStop {
  stopId: string;
  placeId: string;
  name: string;
  category: string;
  imageUrls: string[];
  rating: number | null;
  latitude: number;
  longitude: number;
}

interface SavedItinerary {
  stops: SavedStop[];
  events: unknown[];
  totalEtaMinutes: number;
  warnings: string[];
}

export default function TripMatchSavedResultPage() {
  return (
    <Suspense>
      <TripMatchSavedResultContent />
    </Suspense>
  );
}

function TripMatchSavedResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [destinationLabel, setDestinationLabel] = useState<string>("");
  // *** שומרים את כל ה-itinerary הגולמי (לא רק stops) כדי שמחיקת תחנה
  // תוכל לשמור חזרה ל-DB בלי לאבד שדות אחרים (events/totalEtaMinutes/
  // warnings) שלא מוצגים בכלל במסך הזה.
  const [itinerary, setItinerary] = useState<SavedItinerary | null>(null);
  const [completedCategories, setCompletedCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [justShared, setJustShared] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError("חסר מזהה טיול");
      return;
    }
    fetch(`/api/trip-builder/sessions/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const answers = data.session?.answers as { destination?: string; completedCategories?: string[] } | null;
        const rawItinerary = data.session?.final_itinerary as Partial<SavedItinerary> | null;
        setDestinationLabel(answers?.destination ?? "הטיול שלי");
        setItinerary({
          stops: rawItinerary?.stops ?? [],
          events: rawItinerary?.events ?? [],
          totalEtaMinutes: rawItinerary?.totalEtaMinutes ?? 0,
          warnings: rawItinerary?.warnings ?? [],
        });
        setCompletedCategories(Array.isArray(answers?.completedCategories) ? answers!.completedCategories! : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "לא הצלחנו לטעון את הטיול"));
  }, [sessionId]);

  // *** מחיקת מקום מהטיול השמור - מסירים מקומית מייד (מרגיש מיידי),
  // ואז שומרים את הרשימה המעודכנת חזרה ל-DB דרך PATCH. בלי זה, מחיקה
  // כאן הייתה רק ויזואלית ומקומית - ברענון העמוד המקום היה חוזר, כי
  // הוא עדיין קיים ב-final_itinerary השמור בשרת.
  async function handleDeleteStop(stopId: string) {
    if (!itinerary || !sessionId) return;
    const updatedItinerary: SavedItinerary = { ...itinerary, stops: itinerary.stops.filter((s) => s.stopId !== stopId) };
    setItinerary(updatedItinerary);
    try {
      await fetch(`/api/trip-builder/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ final_itinerary: updatedItinerary }),
      });
    } catch {
      // העדכון האופטימי כבר בוצע - שגיאת רשת לא מבטלת אותו, פשוט לא
      // יישמר בשרת עד לניסיון הבא (אין כאן rollback מכוון, כדי לא
      // "להחזיר" מקום שהמשתמש ביקש בפירוש למחוק).
    }
  }

  async function handleShareTrip() {
    if (!sessionId) return;
    setJustShared(true);
    setTimeout(() => setJustShared(false), 1500);

    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `הטיול שלי ב-TRIPLACE! תראו את המקומות שאהבתי: ${url}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "הטיול שלי ב-TRIPLACE", text, url });
        return;
      } catch {
        // המשתמש ביטל את ה-share sheet
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  // *** "המשך לקטגוריה הבאה" גם מטיול שמור - לא רק מהסשן החי. לוקח את
  // המשתמש חזרה למסך התוצאות החי (/tripmatch) עם resumeSessionId, שם
  // עמוד TripMatch טוען את הטיול הזה מהשרת וממשיך ממנו בדיוק כאילו
  // מעולם לא עזב (ראו אפקט ה-resume ב-app/tripmatch/page.tsx).
  const nextContinueCategory = TRIPMATCH_CATEGORY_BUCKETS.find(
    (bucket) => CONTINUE_CATEGORY_VALUES.includes(bucket.value) && !completedCategories.includes(bucket.value)
  );

  return (
    <Screen withBottomNavSpacing className="!bg-bg !px-0 !pt-0">
      {/* אותו מבנה בר עליון בדיוק כמו שאר עמודי התוצאות (day-trip וכו') -
          לוגו+חזרה משמאל, שיתוף+שמירה מימין. בלי טקסט כותרת בבר עצמו -
          זה מה שיצר את החפיפה הקודמת עם הלוגו. שם היעד יורד לגוף העמוד,
          מעל המפה. */}
      <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
        <div className="relative h-16">
          <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <Image src="/images/trip-tripmatch-logo.png" alt="" width={110} height={34} className="object-contain" />
            <BackButton onBack={() => router.push("/trips")} />
          </div>

          {sessionId && (
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
              <SaveTripIconButton sessionId={sessionId} />
              <button
                type="button"
                onClick={handleShareTrip}
                aria-label="שתף טיול"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink"
              >
                <Image src={justShared ? "/icons/share-active.png" : "/icons/share.png"} alt="" width={26} height={26} />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-5">
        {error ? (
          <p className="pt-16 text-center text-sm text-danger">{error}</p>
        ) : itinerary === null ? (
          <>
            <Skeleton className="h-64 w-full rounded-card" />
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-card" />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* כותרת - שם היעד מעל המפה, בדיוק כמו בשאר עמודי התוצאות. */}
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold text-ink">{destinationLabel}</h1>
              <p className="text-sm text-ink-secondary">{itinerary.stops.length} מקומות · tripmatch</p>
            </div>

            <ResultMap
              stops={itinerary.stops.map((s) => ({ stopId: s.stopId, name: s.name, latitude: s.latitude, longitude: s.longitude }))}
            />
            {/* רשימה עם מחיקה בהחלקה - בדיוק כמו במסך התוצאות החי ובעמוד
                "כל הטיולים" (SwipeToDeleteRow). קודם זה היה div רגיל בלי
                שום מנגנון מחיקה בעמוד הזה בכלל. */}
            <div className="flex flex-col gap-3">
              {itinerary.stops.map((stop) => (
                <SwipeToDeleteRow key={stop.stopId} resetKey={String(itinerary.stops.length)} onDelete={() => handleDeleteStop(stop.stopId)}>
                  {/* *** תיקון: כשהוספתי מחיקה בהחלקה, השורה הפכה ל-div
                      רגיל בלי שום onClick - נשכח להחזיר את הניווט לעמוד
                      האטרקציה. זו הסיבה שלחיצה כאן (בניגוד ללשונית
                      הלייקים, ששם זה כן button עם onClick) לא עשתה כלום. */}
                  <button
                    type="button"
                    onClick={() => router.push(`/place/${stop.placeId}`)}
                    className="flex w-full items-center gap-3 overflow-hidden rounded-card bg-bg-secondary p-3 text-right"
                  >
                    {stop.imageUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={stop.imageUrls[0]} alt={stop.name} className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-2xl">📍</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[15px] font-bold leading-snug text-ink">{stop.name}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-secondary">
                        {getCategoryLabel(stop.category)}
                        {stop.rating != null && ` · ⭐ ${stop.rating.toFixed(1)}`}
                      </p>
                    </div>
                  </button>
                </SwipeToDeleteRow>
              ))}
            </div>

            {nextContinueCategory && sessionId && (
              <button
                type="button"
                onClick={() => router.push(`/tripmatch?resumeSessionId=${sessionId}`)}
                className="rounded-pill py-3 text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
              >
                המשך לקטגוריה הבאה - {nextContinueCategory.label}
              </button>
            )}
          </>
        )}
      </div>

      <MainBottomNav active="favorites" />
    </Screen>
  );
}
