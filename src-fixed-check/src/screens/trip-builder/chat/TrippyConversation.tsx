"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Screen } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";
import type { AbroadVacationAnswers } from "@/services/tripBuilder/types";
import type { ExtractedVacationIntent } from "@/services/tripBuilder/vacationIntentExtractionService";
import { AnswerOptions } from "./AnswerOptions";
import { ChatBubble } from "./ChatBubble";
import { ChatHeader } from "./ChatHeader";
import { RuntrippyPromptBubble } from "./RuntrippyPromptBubble";
import { TypingIndicator } from "./TypingIndicator";
import { UserBubble } from "./UserBubble";
import { TOKEN_COSTS } from "@/constants/tokenCosts";

const TRIPPY_AI_COST = TOKEN_COSTS.trippy_ai_generation;

const INTRO =
  "שלום! אני טריפי AI 👋\n\nסוכן ה-AI האישי של TRIPLACE.\n\nאני כאן כדי להכיר אתכם, להבין בדיוק מה אתם מחפשים, ולבנות עבורכם את החופשה - מהיעדים והאטרקציות ועד המסלול המושלם.\n\nאז בואו נתחיל! מה תרצו לחפש היום?";
const FOLLOW_UP_WITH_SUGGESTIONS = "מעולה, קיבלתי מושג טוב 🙂 לאן בדיוק בא לכם לצאת? הצעתי כמה יעדים שיכולים להתאים:";
const FOLLOW_UP_NO_SUGGESTIONS = "מעולה, קיבלתי מושג טוב 🙂 יש לכם יעד ספציפי בראש, או שתרצו שאני אבחר בשבילכם?";
const SURPRISE_LABEL = "תפתיעו אותי 🎁";

type Stage = "compose" | "followUp" | "building";
type Message = { id: string; role: "assistant" | "user" | "runtrippy"; text: string };
type DestinationChoice = { type: "single"; value: string } | { type: "multi"; values: string[] } | { type: "surprise" };

const DEFAULT_ANSWERS: AbroadVacationAnswers = {
  companions: ["couple"],
  childAgeBands: [],
  startDate: "",
  endDate: "",
  hasBookedFlightAndHotel: false,
  flightPreference: null,
  flights: [],
  hotels: [],
  lodgingType: null,
  budgetPerPerson: "2500-7500",
  vacationTypes: [],
  destination: null,
  destinations: [],
  surpriseMe: false,
  pace: "balanced",
  travelStyle: "single_destination",
  freeText: "",
};

/** תאריכי ברירת מחדל - בעוד שבועיים, 4 לילות - כשלא נשאלו תאריכים בכלל
 *  בזרימה המקוצרת הזו (רק שאלת המשך אחת, ממוקדת יעד בלבד). */
/**
 * *** תיקון (בקשה מפורשת - "אני רוצה כללי! לפי מלל חופשי! עד יום אחד
 * של מסלול"): הוחלט (אחרי בירור מפורש) להישאר על אותו מנגנון בנייה
 * בדיוק (חופשה בחו"ל - יעד כללי כלשהו, לא רק "ליד הבית") ולא לעבור
 * למנגנון "טיול יומי" הנפרד (שמבוסס על GPS/מיקום נוכחי, לא מתאים ליעד
 * כמו "חאניה, יוון"). הדרך הפשוטה והבטוחה להגביל ליום אחד בלי לגעת
 * בכל שרשרת ה-AI: startDate===endDate נותן countDays()=1 באופן טבעי
 * (ר' categoryPlanService.ts) - בלי "לשקר" לשום שירות במורד הזרימה.
 */
function defaultDateRange(): { startDate: string; endDate: string } {
  const start = new Date();
  start.setDate(start.getDate() + 14);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  const iso = toIso(start);
  return { startDate: iso, endDate: iso };
}

function buildAnswers(
  freeText: string,
  extracted: ExtractedVacationIntent | null,
  destinationChoice: DestinationChoice
): AbroadVacationAnswers {
  const { startDate, endDate } = defaultDateRange();
  return {
    ...DEFAULT_ANSWERS,
    startDate,
    endDate,
    freeText,
    requestedPlaceCount: extracted?.requestedPlaceCount ?? null,
    companions: extracted?.companions.length ? extracted.companions : DEFAULT_ANSWERS.companions,
    childAgeBands: extracted?.childAgeBands ?? [],
    hasBookedFlightAndHotel: extracted?.hasBookedFlightAndHotel ?? false,
    lodgingType: extracted?.lodgingType ?? null,
    budgetPerPerson: extracted?.budgetPerPerson ?? DEFAULT_ANSWERS.budgetPerPerson,
    vacationTypes: extracted?.vacationTypes.length ? extracted.vacationTypes : [],
    pace: extracted?.pace ?? DEFAULT_ANSWERS.pace,
    travelStyle: destinationChoice.type === "multi" ? "multi_destination" : "single_destination",
    destination: destinationChoice.type === "single" ? destinationChoice.value : null,
    destinations: destinationChoice.type === "multi" ? destinationChoice.values : [],
    surpriseMe: destinationChoice.type === "surprise",
  };
}

function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return getCurrentPositionSafe("יש לאשר גישה למיקום ולנסות שוב");
}

/** צ'אט חופשי אחד: אינטרו קבוע -> מלל חופשי -> שאלת המשך אחת (ממוקדת
 *  יעד, עם צ'יפים שחולצו מאותה קריאת AI יחידה - ר' vacationIntentExtractionService)
 *  -> בניית "חופשה בחו"ל" ומעבר לעמוד התוצאה שלה. */
export function TrippyConversation() {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([{ id: "intro", role: "assistant", text: INTRO }]);
  const [stage, setStage] = useState<Stage>("compose");
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  // *** תוספת (בקשה מפורשת - "טעינה של שלוש נקודות שחושבות עד שמגיעים
  // למסלול, מעל RUNTRIPPY"): true בדיוק בזמן ה-polling האמיתי ב-
  // autoBuildAndWaitThenNavigate (לא רק 500ms הפתיחה הקצרים כמו typing
  // הרגיל) - כפתור ה-runtrippy עצמו נשאר גלוי/פעיל תמיד (עדיין אפשר
  // ללחוץ ולעבור למסך הבנייה ידנית), רק מציגים גם אינדיקציה חזותית
  // שמשהו קורה ברקע בינתיים.
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const freeTextRef = useRef("");
  const extractedRef = useRef<ExtractedVacationIntent | null>(null);
  const sessionPromiseRef = useRef<Promise<string> | null>(null);
  const manualGameRequestedRef = useRef(false);
  const navigatedToResultRef = useRef(false);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, stage]);

  // *** תיקון (בקשת המשתמש - "Encountered two children with the same
  // key, `4`" - קריסת React חוזרת): id.current += 1 (מונה פשוט) לא
  // אמין מספיק - במקרים מסוימים (למשל שתי קריאות add() רצופות בתוך
  // אותו setTimeout/batch) נוצרו שני הודעות עם אותו מזהה. crypto.
  // randomUUID() מבטל את כל המחלקה הזו של באגים - כל הודעה מקבלת
  // מזהה ייחודי אמיתי, בלי תלות בתזמון רינדור.
  const add = (role: Message["role"], message: string) => {
    setMessages((all) => [...all, { id: crypto.randomUUID(), role, text: message }]);
  };

  async function fetchExtractedIntent(freeText: string): Promise<ExtractedVacationIntent | null> {
    try {
      const res = await fetch("/api/trip-builder/abroad-vacation/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeText }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.extracted as ExtractedVacationIntent) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * *** תיקון (בקשה מפורשת - שלישית ומדויקת: "אחרי שממלאים את התשובה
   * של המשתמש - יש את מה שביקשתי... ואז זה מופיע שוב בעמוד של הטיול
   * כבר!!! זה אמור להיות רק בצ'אט!! עד שעולה הטיול המלא"): הבעיה
   * האמיתית - הרצף בצ'אט היה מוצג לזמן *קבוע* (setTimeout), לא לזמן
   * שבאמת לוקח להביא את התוצאות - אז כשה-fetch בעמוד התוצאה עדיין
   * רץ (כמה שניות), המשתמש ראה שם עוד מסך טעינה, "שוב". התיקון: קוראים
   * ל-API **כאן, מתוך הצ'אט**, ומחכים שהוא *באמת* יסתיים (לא זמן קבוע)
   * לפני שמנווטים בכלל - כך שברגע שמגיעים לעמוד התוצאה, הנתונים כבר
   * מוכנים לגמרי ואין שם שום מסך טעינה נוסף. התוצאה נשמרת ב-
   * sessionStorage (לא ב-URL - יכולה להיות ארוכה מדי) ועמוד התוצאה
   * קורא אותה משם ישירות, בלי fetch משלו בכלל.
   */
  async function submitFreeText() {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    add("user", trimmed);
    setText("");
    setStage("building");
    setTyping(true);
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    setTyping(false);
    add("assistant", "בונים עבורכם את המסלול המושלם!");
    add("runtrippy", "");
    setBuilding(true);

    try {
      const coords = await getCurrentPositionSafe().catch(() => null);
      const res = await fetch("/api/trip-builder/trippy-quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeText: trimmed, lat: coords?.lat ?? null, lng: coords?.lng ?? null }),
      });
      const data = await res.json();

      // *** מערכת "טריפים" (דרישה מפורשת): בניית טיול עולה TOKEN_COSTS.trippy_ai_generation טריפים -
      // אם אין מספיק, השרת לא ביצע (ולא חייב) שום דבר. לא מנווטים לעמוד
      // תוצאה של טיול שלא נוצר - מציגים הודעה ברורה בצ'אט וחוזרים למצב
      // כתיבה, כדי שהמשתמש יבין בדיוק למה ולא "יתקע" על מסך טעינה.
      if (!res.ok) {
        setBuilding(false);
        if (data?.error === "INSUFFICIENT_TOKENS") {
          add(
            "assistant",
            `אין לכם מספיק טריפים 😕\nבניית טיול באמצעות Trippy AI עולה ${data.cost ?? 20} טריפים.\nנשארו לכם ${data.remainingTokens ?? 0} טריפים.`
          );
        } else {
          add("assistant", "משהו השתבש בבניית המסלול - נסו שוב.");
        }
        setStage("compose");
        return;
      }

      const requestId = crypto.randomUUID();
      sessionStorage.setItem(`trippy-quick:${requestId}`, JSON.stringify(data));
      router.push(`/trip-builder/trippy-quick/result?requestId=${requestId}`);
    } catch {
      setBuilding(false);
      add("assistant", "משהו השתבש בבניית המסלול - נסו שוב.");
      setStage("compose");
    }
  }

  function chooseDestination(value: string) {
    add("user", value);
    startBuild({ type: "single", value });
  }

  function chooseSurprise() {
    add("user", SURPRISE_LABEL);
    startBuild({ type: "surprise" });
  }

  function startBuild(destinationChoice: DestinationChoice) {
    setStage("building");
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      add("assistant", "בונים עבורכם את הטיול המושלם!");
      add("runtrippy", "");
      setBuilding(true);
      autoBuildAndWaitThenNavigate(destinationChoice);
    }, 500);
  }

  function ensureSessionCreated(destinationChoice: DestinationChoice): Promise<string> {
    if (!sessionPromiseRef.current) {
      sessionPromiseRef.current = createSessionAndStartBuild(destinationChoice);
    }
    return sessionPromiseRef.current;
  }

  async function createSessionAndStartBuild(destinationChoice: DestinationChoice): Promise<string> {
    const answers = buildAnswers(freeTextRef.current, extractedRef.current, destinationChoice);
    const origin = await getCurrentPosition();
    const response = await fetch("/api/trip-builder/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripType: "abroad_vacation", answers, origin }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "יצירת הטיול נכשלה");

    const sessionId = data.session.id;
    fetch(`/api/trip-builder/sessions/${sessionId}/auto-build`, { method: "POST" }).catch(() => {});
    return sessionId;
  }

  async function handleRuntrippyClick() {
    if (manualGameRequestedRef.current) return;
    manualGameRequestedRef.current = true;
    if (!user) {
      router.push("/auth");
      return;
    }
    try {
      const sessionId = await ensureSessionCreated({ type: "surprise" });
      if (navigatedToResultRef.current) return;
      navigatedToResultRef.current = true;
      router.push(`/trip-builder/abroad-vacation/result?sessionId=${sessionId}&game=1`);
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : "לא הצלחנו לבנות את הטיול. נסו שוב.");
    }
  }

  /** יוצר session, מפעיל auto-build ברקע, וממתין (polling) לסטטוס
   *  completed בלבד - אותו עיקרון בדיוק כמו weekend/abroad-vacation:
   *  או שנמצאים בצ'אט, או שנמצאים בעמוד התוצאה, שום מסך ביניים שלישי. */
  async function autoBuildAndWaitThenNavigate(destinationChoice: DestinationChoice) {
    if (!user) return;
    setError(null);
    try {
      const sessionId = await ensureSessionCreated(destinationChoice);
      if (manualGameRequestedRef.current) return;

      const MAX_WAIT_MS = 90000;
      const POLL_INTERVAL_MS = 1000;
      const startedAt = Date.now();
      let completed = false;
      while (Date.now() - startedAt < MAX_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (manualGameRequestedRef.current) return;
        try {
          const pollRes = await fetch(`/api/trip-builder/sessions?sessionId=${sessionId}`);
          const pollData = await pollRes.json();
          if (pollData?.session?.status === "completed") {
            completed = true;
            break;
          }
        } catch {
          // שגיאת רשת חד-פעמית - ממשיכים לנסות
        }
      }

      if (manualGameRequestedRef.current || navigatedToResultRef.current) return;

      if (completed) {
        navigatedToResultRef.current = true;
        router.push(`/trip-builder/abroad-vacation/result?sessionId=${sessionId}`);
        return;
      }

      setBuilding(false);
      setTyping(false);
      add("assistant", "זה לוקח קצת יותר זמן מהרגיל... אפשר להמשיך להמתין כאן, או ללחוץ על הלוגו למעלה כדי לעבור למסך הבנייה.");
    } catch (buildError) {
      setBuilding(false);
      sessionPromiseRef.current = null;
      setError(buildError instanceof Error ? buildError.message : "לא הצלחנו לבנות את הטיול. נסו שוב.");
    }
  }

  const suggestions = extractedRef.current?.suggestedDestinations ?? [];

  return (
    <Screen withBottomNavSpacing className="pb-0">
      <div className="-mx-5 -mt-8">
        <ChatHeader current={stage === "compose" ? 0 : 1} total={stage === "compose" ? 0 : 2} onBack={() => router.push("/home")} />
      </div>
      {/* *** תיקון (בקשה מפורשת - "להחזיר את הבר התחתון - שהחיפוש
          והכפתור המשך יהיו מעליו"): MainBottomNav חזר (בקשה קודמת
          ביקשה להסיר אותו, זו ביקשה להחזיר) - Screen חזר ל-
          withBottomNavSpacing. ה-footer הקבוע כבר לא bottom-0 - עכשיו
          bottom-20, מעל גובה הבר התחתון (BottomNav.tsx: כ-80px).
          pb-56 ברשימת ההודעות מפנה מקום גם ל-footer וגם לבר יחד. */}
      <div className="mx-auto flex max-w-md flex-col gap-4 px-1 pt-4 pb-56">
        {messages.map((message) => {
          if (message.role === "assistant") return <ChatBubble key={message.id}>{message.text}</ChatBubble>;
          if (message.role === "runtrippy")
            return (
              <div key={message.id} className="flex flex-col gap-2">
                {building && <TypingIndicator />}
                <RuntrippyPromptBubble onClick={handleRuntrippyClick} />
              </div>
            );
          return <UserBubble key={message.id}>{message.text}</UserBubble>;
        })}

        {typing && <TypingIndicator />}

        {stage === "followUp" && !typing && (
          <AnswerOptions
            options={[
              ...suggestions.map((destination) => ({ value: destination, label: destination })),
              { value: "__surprise__", label: SURPRISE_LABEL },
            ]}
            onSelect={(value) => (value === "__surprise__" ? chooseSurprise() : chooseDestination(value))}
          />
        )}

        {error && <p className="text-center text-sm text-danger">{error}</p>}
        <div ref={bottom} />
      </div>

      {stage === "compose" && !typing && (
        <div className="fixed inset-x-0 bottom-24 z-40 border-t border-ink-secondary/10 bg-bg-secondary px-5 pb-3 pt-3">
          <div className="mx-auto flex max-w-md flex-col gap-2">
            <p className="text-center text-[11px] font-medium text-ink-secondary">בניית טיול — {TRIPPY_AI_COST} טריפים</p>
            <button
              type="button"
              onClick={submitFreeText}
              disabled={!text.trim()}
              className="w-full rounded-pill py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              המשך
            </button>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="אני רוצה חופשת בטן גב ביוון, טיול בניו יורק..."
              rows={1}
              autoFocus
              className="w-full rounded-card border border-ink-secondary/25 bg-bg p-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>
      )}
      <MainBottomNav active="ai" />
    </Screen>
  );
}
