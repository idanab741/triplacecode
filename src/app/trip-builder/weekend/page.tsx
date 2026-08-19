"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Screen, ChipGroup, Field, Slider } from "@/components/ui";
import { DateRangePicker } from "@/screens/trip-builder/chat/DateRangePicker";
import { HotelAutocomplete } from "@/screens/trip-builder/chat/HotelAutocomplete";
import { LoadingGame } from "@/screens/trip-builder/LoadingGame";
import { RuntrippyPromptBubble } from "@/screens/trip-builder/chat/RuntrippyPromptBubble";
import {
  VACATION_COMPANION_OPTIONS,
  VACATION_CHILD_AGE_OPTIONS,
  LODGING_TYPE_OPTIONS,
  VACATION_PACE_OPTIONS,
} from "@/locales/he/abroadVacation";
import { WEEKEND_STYLE_OPTIONS, WEEKEND_BUDGET_STEPS } from "@/locales/he/weekend";
import { DISTANCE_STEPS } from "@/locales/he/tripBuilder";
import type { WeekendAnswers } from "@/services/tripBuilder/types";
import type { ExtractedWeekendIntent } from "@/services/tripBuilder/weekendIntentExtractionService";
import { TripBuilderHeader } from "@/screens/trip-builder/chat/TripBuilderHeader";
import { ChatBubble } from "@/screens/trip-builder/chat/ChatBubble";
import { UserBubble } from "@/screens/trip-builder/chat/UserBubble";
import { TypingIndicator } from "@/screens/trip-builder/chat/TypingIndicator";
import { AnswerOptions } from "@/screens/trip-builder/chat/AnswerOptions";
import { MainBottomNav } from "@/components/MainBottomNav";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";

/**
 * בקשה מפורשת - אותה ארכיטקטורה בדיוק כמו חופשה בחו"ל
 * (app/trip-builder/abroad-vacation/page.tsx): המלל החופשי הוא השאלה
 * השנייה (מיד אחרי תאריכים, לא בסוף), עם חילוץ AI ("advance") שמדלג
 * אוטומטית על כל שאלה שכבר נענתה בתוכו, ובחירת "בואו נבנה יחד" (ממשיך
 * לשאול את מה שלא כוסה) / "אמשיך לבד" (בונה ישר, עם "תפתיעו אותנו"
 * לשדות שלא כוסו). בשונה מחופשה בחו"ל - אין כאן יעד/טיסה (סופ"ש הוא
 * תמיד בארץ), אז השלבים המקבילים (travelStyle/destination/flights) לא
 * קיימים כאן בכלל.
 */
type Stage =
  | "dates"
  | "freeIntent"
  | "companions"
  | "childAges"
  | "distanceBand"
  | "bookedQuestion"
  | "lodgingInfo"
  | "lodgingType"
  | "budget"
  | "weekendStyles"
  | "pace";

const STAGE_TITLES: Record<Stage, string> = {
  dates: "מתי נוסעים? תאריך התחלה",
  freeIntent: 'ספרו לי על הסופ"ש שאתם מדמיינים',
  companions: "עם מי אתם נוסעים?",
  childAges: "גילאי הילדים",
  distanceBand: "מרחק מקסימלי לנסיעה",
  bookedQuestion: "האם כבר סגרתם מקום לינה?",
  lodgingInfo: "איפה מקום הלינה?",
  lodgingType: "איזה סוג לינה אתם מחפשים?",
  budget: "מה התקציב?",
  weekendStyles: 'איזה סגנון סופ"ש אתם מחפשים?',
  pace: "מה קצב הטיול שלכם?",
};

const DEFAULT_ANSWERS: WeekendAnswers = {
  companions: ["couple"],
  childAgeBands: [],
  startDate: "",
  endDate: "",
  distanceBand: "1h",
  hasBookedLodging: false,
  lodgingName: null,
  lodgingAddress: null,
  lodgingType: null,
  weekendStyles: [],
  pace: "balanced",
  budgetPerPerson: "1000-3000",
  freeText: "",
};

type ChatMessage = { id: number; role: "assistant" | "user" | "icon" | "runtrippy"; text: string; editStage?: Stage };

function UserAvatar({ avatarUrl, name }: { avatarUrl: string | null; name: string | null }) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "👤";
  if (avatarUrl) {
    return (
      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-black/5">
        <Image src={avatarUrl} alt="" fill className="object-cover" />
      </div>
    );
  }
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
    >
      {initial}
    </div>
  );
}

export default function WeekendQuestionnairePage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [stage, setStage] = useState<Stage>("dates");
  const [form, setForm] = useState<WeekendAnswers>(DEFAULT_ANSWERS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [readyToBuild, setReadyToBuild] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // מלל חופשי + חילוץ AI - מיד אחרי תאריכים
  const [tempFreeIntent, setTempFreeIntent] = useState("");
  const [extractingIntent, setExtractingIntent] = useState(false);
  const extractedIntentRef = useRef<ExtractedWeekendIntent | null>(null);

  // temp state per stage
  const [tempCompanions, setTempCompanions] = useState<string[]>([]);
  const [tempChildAges, setTempChildAges] = useState<string[]>([]);
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [tempDistance, setTempDistance] = useState<string | null>(null);
  const [tempBooked, setTempBooked] = useState<string | null>(null);
  const [tempLodgingName, setTempLodgingName] = useState("");
  const [tempLodgingAddress, setTempLodgingAddress] = useState("");
  const [tempLodgingType, setTempLodgingType] = useState<string | null>(null);
  const [tempStyles, setTempStyles] = useState<string[]>([]);
  const [tempPace, setTempPace] = useState<string | null>(null);
  const [tempBudget, setTempBudget] = useState<string | null>(null);

  // עריכת תשובות קודמות - לוחצים על בועת המשתמש כדי לפתוח מחדש את אותה שאלה
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [editTempValue, setEditTempValue] = useState<string | null>(null);
  const [editTempMultiValue, setEditTempMultiValue] = useState<string[]>([]);
  const [editTempStartDate, setEditTempStartDate] = useState("");
  const [editTempEndDate, setEditTempEndDate] = useState("");
  const [editTempFreeText, setEditTempFreeText] = useState("");
  const [editTempLodgingName, setEditTempLodgingName] = useState("");
  const [editTempLodgingAddress, setEditTempLodgingAddress] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const startedRef = useRef(false);
  const pendingBuildAnswersRef = useRef<WeekendAnswers | null>(null);
  // תיקון באג אמיתי (בקשה מפורשת - "המשחק עדיין מועבר באופן אוטומטי!!
  // ביקשתי שיופיע רק אם לוחצים על הלוגו!"): קודם דגל בודד (runtrippyTriggeredRef)
  // שימש גם כ"מי מנצח במרוץ בין הנתיב האוטומטי לנתיב הלחיצה הידנית" וגם
  // כ"מונע יצירת session כפולה" - promptBuildTrip קורא ל-autoBuildAndWaitThenNavigate
  // מיד (כמעט באותו tick סינכרוני שבו בועת ה-runtrippy מוצגת), וזה היה
  // מסמן את הדגל כ-true *באותו רגע* - כך שבפועל, לא היה שום חלון זמן
  // אמיתי שבו handleRuntrippyClick (לחיצה על הבועה) לא נחסם מיד ע"י
  // הבדיקה `if (runtrippyTriggeredRef.current) return;` בתחילתו. התוצאה:
  // לחיצה על הלוגו לא עשתה כלום בפועל, ומסך התוצאה (result/page.tsx)
  // תמיד הגיע דרך הנתיב האוטומטי - זו הסיבה שהמשחק "תמיד" הופיע (בשילוב
  // עם game=1 החסר בנתיב הזה, שתוקן למטה). הפתרון: להפריד בין "האם כבר
  // נוצר session" (sessionPromiseRef - משותף, כדי לא ליצור session כפול)
  // לבין "האם המשתמש ביקש את המשחק" (manualGameRequestedRef) - עכשיו
  // לחיצה על הבועה **בכל שלב**, גם תוך כדי ההמתנה האוטומטית, "חוטפת"
  // את הניווט (עם game=1) בלי ליצור session נוסף.
  const sessionPromiseRef = useRef<Promise<string> | null>(null);
  const manualGameRequestedRef = useRef(false);
  const navigatedToResultRef = useRef(false);

  function nextId() {
    idRef.current += 1;
    return idRef.current;
  }
  function addBot(text: string) {
    setMessages((m) => [...m, { id: nextId(), role: "assistant", text }]);
  }
  function addUser(text: string, editStage?: Stage) {
    setMessages((m) => [...m, { id: nextId(), role: "user", text, editStage }]);
  }
  function addIconBadge(label: string) {
    setMessages((m) => [...m, { id: nextId(), role: "icon", text: label }]);
  }
  function addRuntrippyPrompt() {
    setMessages((m) => [...m, { id: nextId(), role: "runtrippy", text: "" }]);
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    addBot('שלום! אני טריפי AI 👋\nבואו נתכנן ביחד את הסופ"ש הבא שלכם.');
    addIconBadge('סופ"ש');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      addBot(STAGE_TITLES.dates);
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // תיקון באג אמיתי (בקשה מפורשת - "למה בשורת ההתאמה של האטרקציות
  // והקטגוריות לא מופיע לי כבר האטרקציות ששמורות אצלי? כמו שיש בחופשה
  // בחו"ל???"): בחופשה בחו"ל, שלב "מה אתם אוהבים לעשות" כבר ממלא מראש
  // מה-Travel DNA הקיים (ר' vacationTypes effect שם) - בסופ"ש לא היה שום
  // מקבילה, ולכן weekendStyles תמיד התחיל ריק לגמרי גם כשלמשתמש כבר יש
  // היסטוריה/העדפות שמורות. אותו עיקרון בדיוק, רק מול endpoint ייעודי
  // (weekend-style-defaults) שממפה לערכי WEEKEND_STYLE_OPTIONS. לא דורס
  // בחירה שהמשתמש כבר עשה בעצמו (tempStyles לא ריק).
  useEffect(() => {
    if (stage !== "weekendStyles" || tempStyles.length > 0) return;
    const fromFreeText = extractedIntentRef.current?.weekendStyles ?? [];
    fetch("/api/trip-builder/weekend-style-defaults")
      .then((res) => res.json())
      .then((data) => {
        const fromDna: string[] = Array.isArray(data.weekendStyles) ? data.weekendStyles : [];
        const merged = Array.from(new Set([...fromFreeText, ...fromDna]));
        if (merged.length > 0) {
          setTempStyles((current) => (current.length === 0 ? merged : current));
        }
      })
      .catch(() => {
        // גם אם השליפה מה-DNA נכשלת - עדיין ממלאים לפחות ממה שחולץ מהמלל.
        if (fromFreeText.length > 0) {
          setTempStyles((current) => (current.length === 0 ? fromFreeText : current));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function labelFor(options: { value: string; label: string }[], value: string) {
    return options.find((o) => o.value === value)?.label ?? value;
  }
  function labelsFor(options: { value: string; label: string }[], values: string[]) {
    return values.map((v) => labelFor(options, v));
  }

  function goTo(next: Stage, botTitle?: string) {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setStage(next);
      if (botTitle) addBot(botTitle);
      else if (STAGE_TITLES[next]) addBot(STAGE_TITLES[next]);
    }, 550);
  }

  /**
   * דיספצ'ר שמודע לחילוץ מהמלל החופשי - אותו עיקרון בדיוק כמו advance()
   * בחופשה בחו"ל: מקבל את השלב שהיינו הולכים אליו רגיל (goTo), ובודק אם
   * extractedIntentRef כבר מכסה אותו - ממלא אותו אוטומטית (setForm +
   * בועת משתמש, בדיוק כאילו המשתמש ענה בעצמו) וממשיך לבדוק את השלב הבא
   * באותה שרשרת שה-confirm* הרגילים משתמשים בה. עוצר ופונה ל-goTo הרגיל
   * ברגע שמגיע לשלב שלא כוסה בחילוץ, או שאין בכלל תוצאת חילוץ.
   */
  function advance(nextStage: Stage, current: WeekendAnswers) {
    const extracted = extractedIntentRef.current;
    if (!extracted) {
      goTo(nextStage);
      return;
    }

    if (nextStage === "companions" && extracted.companions.length > 0) {
      const next = { ...current, companions: extracted.companions as WeekendAnswers["companions"] };
      setForm(next);
      addUser(labelsFor(VACATION_COMPANION_OPTIONS, extracted.companions).join("، "), "companions");
      advance(next.companions.includes("family") ? "childAges" : "distanceBand", next);
      return;
    }

    if (nextStage === "childAges" && extracted.childAgeBands.length > 0) {
      const next = { ...current, childAgeBands: extracted.childAgeBands };
      setForm(next);
      addUser(labelsFor(VACATION_CHILD_AGE_OPTIONS, extracted.childAgeBands).join("، "), "childAges");
      advance("distanceBand", next);
      return;
    }

    if (nextStage === "distanceBand" && extracted.distanceBand) {
      const next = { ...current, distanceBand: extracted.distanceBand as WeekendAnswers["distanceBand"] };
      setForm(next);
      addUser(labelFor(DISTANCE_STEPS, extracted.distanceBand), "distanceBand");
      advance("bookedQuestion", next);
      return;
    }

    if (nextStage === "bookedQuestion" && typeof extracted.hasBookedLodging === "boolean") {
      const next = { ...current, hasBookedLodging: extracted.hasBookedLodging };
      setForm(next);
      addUser(extracted.hasBookedLodging ? "כן" : "לא", "bookedQuestion");
      advance(next.hasBookedLodging ? "lodgingInfo" : "lodgingType", next);
      return;
    }

    // lodgingInfo: אף פעם לא מחולץ מהמלל (פרטים לוגיסטיים ממשיים - שם/כתובת
    // מקום לינה קונקרטי - שלא הגיוני "לנחש" מתיאור כללי), תמיד ל-UI הרגיל.

    if (nextStage === "lodgingType" && extracted.lodgingType) {
      const next = { ...current, lodgingType: extracted.lodgingType };
      setForm(next);
      addUser(labelFor(LODGING_TYPE_OPTIONS, extracted.lodgingType), "lodgingType");
      advance("budget", next);
      return;
    }

    if (nextStage === "budget" && extracted.budgetPerPerson) {
      const next = { ...current, budgetPerPerson: extracted.budgetPerPerson };
      setForm(next);
      addUser(labelFor(WEEKEND_BUDGET_STEPS, extracted.budgetPerPerson), "budget");
      advance("weekendStyles", next);
      return;
    }

    // בקשה מפורשת (כמו ב"מה אתם אוהבים לעשות" בחופשה בחו"ל): "איזה סגנון
    // סופ"ש" תמיד מוצג אינטראקטיבית, לא מדלגים עליו בשקט גם אם חולצו
    // סגנונות מהמלל - הערכים שחולצו עדיין ממלאים ברירת מחדל מסומנת.

    if (nextStage === "pace" && extracted.pace) {
      const next = { ...current, pace: extracted.pace };
      setForm(next);
      addUser(labelFor(VACATION_PACE_OPTIONS, extracted.pace), "pace");
      // pace הוא השלב האחרון - אם גם הוא כוסה בחילוץ, מציגים "בונים..." + בועת runtrippy.
      promptBuildTrip(next);
      return;
    }

    goTo(nextStage);
  }

  /** קריאת השרת שמחלצת תשובות מהמלל החופשי - עד ~2 שניות (מודל Haiku מהיר). */
  async function fetchExtractedIntent(freeText: string): Promise<ExtractedWeekendIntent | null> {
    try {
      const res = await fetch("/api/trip-builder/weekend/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeText }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.extracted as ExtractedWeekendIntent) ?? null;
    } catch {
      return null;
    }
  }

  async function confirmFreeIntentTogether() {
    const text = tempFreeIntent.trim();
    if (!text || extractingIntent) return;
    addUser(text, "freeIntent");
    const next = { ...form, freeText: text };
    setForm(next);
    setTempFreeIntent("");
    setExtractingIntent(true);
    setTyping(true);
    extractedIntentRef.current = await fetchExtractedIntent(text);
    setExtractingIntent(false);
    setTyping(false);
    advance("companions", next);
  }

  async function confirmFreeIntentAlone() {
    const text = tempFreeIntent.trim();
    if (!text || extractingIntent) return;
    addUser(text, "freeIntent");
    const next = { ...form, freeText: text };
    setForm(next);
    setTempFreeIntent("");
    setExtractingIntent(true);
    setTyping(true);
    await fetchExtractedIntent(text); // רק כדי לשמור freeText - "אמשיך לבד" לא ממלא שדות, בונה עם ברירות מחדל
    setExtractingIntent(false);
    setTyping(false);
    promptBuildTrip(next);
  }

  function confirmCompanions() {
    if (tempCompanions.length === 0) return;
    const next = { ...form, companions: tempCompanions as WeekendAnswers["companions"] };
    setForm(next);
    addUser(labelsFor(VACATION_COMPANION_OPTIONS, tempCompanions).join("، "), "companions");
    advance(tempCompanions.includes("family") ? "childAges" : "distanceBand", next);
  }

  function confirmChildAges() {
    const next = { ...form, childAgeBands: tempChildAges as WeekendAnswers["childAgeBands"] };
    setForm(next);
    addUser(tempChildAges.length > 0 ? labelsFor(VACATION_CHILD_AGE_OPTIONS, tempChildAges).join("، ") : "לא רלוונטי", "childAges");
    advance("distanceBand", next);
  }

  function confirmDates() {
    if (!tempStartDate || !tempEndDate) return;
    setForm((f) => ({ ...f, startDate: tempStartDate, endDate: tempEndDate }));
    addUser(`${tempStartDate} עד ${tempEndDate}`, "dates");
    goTo("freeIntent");
  }

  function confirmDistance() {
    const value = tempDistance ?? DISTANCE_STEPS[0].value;
    const next = { ...form, distanceBand: value as WeekendAnswers["distanceBand"] };
    setForm(next);
    addUser(labelFor(DISTANCE_STEPS, value), "distanceBand");
    advance("bookedQuestion", next);
  }

  function confirmBooked() {
    if (!tempBooked) return;
    const booked = tempBooked === "yes";
    const next = { ...form, hasBookedLodging: booked };
    setForm(next);
    addUser(booked ? "כן" : "לא", "bookedQuestion");
    advance(booked ? "lodgingInfo" : "lodgingType", next);
  }

  function confirmLodgingInfo() {
    if (!tempLodgingName && !tempLodgingAddress) return;
    // תיקון באג אמיתי (בקשה מפורשת - "הזנתי את מקום הלינה - והוא לא
    // מופיע בליינאפ!!" + "המסלול שוב מפנה אותי חזרה לתל אביב"): אם
    // המשתמש הקליד שם מלון בלי לבחור הצעה מהרשימה (למשל כי הרשימה
    // נחתכה/לא הייתה נגישה - ר' תיקון HotelAutocomplete למעלה, או סתם
    // הקליד וקפץ ישר ל"המשך") - tempLodgingAddress נשאר ריק, ו-`|| null`
    // הפך אותו ל-null. lodgingAddress=null אומר ל-auto-build/route.ts
    // שאין בכלל לינה לגאוקד - הוא נופל חזרה למיקום הבית של המשתמש (בפועל
    // תל אביב/נתניה) לכל הטיול, בדיוק כמו לפני שהוזנה לינה בכלל. עכשיו,
    // בהיעדר כתובת מובנית (מ-Google Place Details), משתמשים בשם שהמשתמש
    // הקליד בעצמו כמחרוזת לגיאוקודינג - geocodePlaceName בשרת עדיין יכול
    // לרוב לפענח שם מלון/צימר, גם בלי כתובת מדויקת, במקום לוותר לגמרי.
    const resolvedLodgingAddress = tempLodgingAddress || tempLodgingName || null;
    const next = { ...form, lodgingName: tempLodgingName || null, lodgingAddress: resolvedLodgingAddress };
    setForm(next);
    addUser(tempLodgingName || tempLodgingAddress, "lodgingInfo");
    advance("budget", next);
  }

  function confirmLodgingType() {
    if (!tempLodgingType) return;
    const next = { ...form, lodgingType: tempLodgingType as WeekendAnswers["lodgingType"] };
    setForm(next);
    addUser(labelFor(LODGING_TYPE_OPTIONS, tempLodgingType), "lodgingType");
    advance("budget", next);
  }

  function confirmBudget() {
    if (!tempBudget) return;
    const next = { ...form, budgetPerPerson: tempBudget };
    setForm(next);
    addUser(labelFor(WEEKEND_BUDGET_STEPS, tempBudget), "budget");
    advance("weekendStyles", next);
  }

  function confirmStyles() {
    const next = { ...form, weekendStyles: tempStyles };
    setForm(next);
    addUser(tempStyles.length > 0 ? labelsFor(WEEKEND_STYLE_OPTIONS, tempStyles).join("، ") : "תפתיעו אותנו", "weekendStyles");
    advance("pace", next);
  }

  function confirmPace() {
    if (!tempPace) return;
    const next = { ...form, pace: tempPace as WeekendAnswers["pace"] };
    setForm(next);
    addUser(labelFor(VACATION_PACE_OPTIONS, tempPace), "pace");
    promptBuildTrip(next);
  }

  function openEdit(message: ChatMessage) {
    if (!message.editStage || typing || submitting || editingMessageId != null) return;
    setEditingMessageId(message.id);
    setEditingStage(message.editStage);

    if (message.editStage === "companions") setEditTempMultiValue(form.companions);
    else if (message.editStage === "childAges") setEditTempMultiValue(form.childAgeBands);
    else if (message.editStage === "dates") {
      setEditTempStartDate(form.startDate);
      setEditTempEndDate(form.endDate);
    } else if (message.editStage === "freeIntent") setEditTempFreeText(form.freeText);
    else if (message.editStage === "distanceBand") setEditTempValue(form.distanceBand);
    else if (message.editStage === "bookedQuestion") setEditTempValue(form.hasBookedLodging ? "yes" : "no");
    else if (message.editStage === "lodgingInfo") {
      setEditTempLodgingName(form.lodgingName ?? "");
      setEditTempLodgingAddress(form.lodgingAddress ?? "");
    } else if (message.editStage === "lodgingType") setEditTempValue(form.lodgingType ?? "");
    else if (message.editStage === "weekendStyles") setEditTempMultiValue(form.weekendStyles);
    else if (message.editStage === "pace") setEditTempValue(form.pace);
    else if (message.editStage === "budget") setEditTempValue(form.budgetPerPerson);
  }

  function closeEdit() {
    setEditingMessageId(null);
    setEditingStage(null);
    setEditTempValue(null);
    setEditTempMultiValue([]);
    setEditTempStartDate("");
    setEditTempEndDate("");
    setEditTempFreeText("");
    setEditTempLodgingName("");
    setEditTempLodgingAddress("");
  }

  function updateMessageLabel(newLabel: string) {
    setMessages((msgs) => msgs.map((msg) => (msg.id === editingMessageId ? { ...msg, text: newLabel } : msg)));
  }

  function confirmEdit() {
    if (!editingStage || editingMessageId == null) return;

    if (editingStage === "companions") {
      if (editTempMultiValue.length === 0) return;
      setForm((f) => ({ ...f, companions: editTempMultiValue as WeekendAnswers["companions"] }));
      updateMessageLabel(labelsFor(VACATION_COMPANION_OPTIONS, editTempMultiValue).join("، "));
    } else if (editingStage === "childAges") {
      setForm((f) => ({ ...f, childAgeBands: editTempMultiValue as WeekendAnswers["childAgeBands"] }));
      updateMessageLabel(editTempMultiValue.length > 0 ? labelsFor(VACATION_CHILD_AGE_OPTIONS, editTempMultiValue).join("، ") : "לא רלוונטי");
    } else if (editingStage === "dates") {
      if (!editTempStartDate || !editTempEndDate) return;
      setForm((f) => ({ ...f, startDate: editTempStartDate, endDate: editTempEndDate }));
      updateMessageLabel(`${editTempStartDate} עד ${editTempEndDate}`);
    } else if (editingStage === "freeIntent") {
      setForm((f) => ({ ...f, freeText: editTempFreeText }));
      updateMessageLabel(editTempFreeText || "—");
    } else if (editingStage === "distanceBand") {
      if (!editTempValue) return;
      setForm((f) => ({ ...f, distanceBand: editTempValue as WeekendAnswers["distanceBand"] }));
      updateMessageLabel(labelFor(DISTANCE_STEPS, editTempValue));
    } else if (editingStage === "bookedQuestion") {
      if (!editTempValue) return;
      const booked = editTempValue === "yes";
      setForm((f) => ({ ...f, hasBookedLodging: booked }));
      updateMessageLabel(booked ? "כן" : "לא");
    } else if (editingStage === "lodgingInfo") {
      if (!editTempLodgingName && !editTempLodgingAddress) return;
      const resolvedLodgingAddress = editTempLodgingAddress || editTempLodgingName || null;
      setForm((f) => ({ ...f, lodgingName: editTempLodgingName || null, lodgingAddress: resolvedLodgingAddress }));
      updateMessageLabel(editTempLodgingName || editTempLodgingAddress);
    } else if (editingStage === "lodgingType") {
      if (!editTempValue) return;
      setForm((f) => ({ ...f, lodgingType: editTempValue as WeekendAnswers["lodgingType"] }));
      updateMessageLabel(labelFor(LODGING_TYPE_OPTIONS, editTempValue));
    } else if (editingStage === "weekendStyles") {
      setForm((f) => ({ ...f, weekendStyles: editTempMultiValue }));
      updateMessageLabel(editTempMultiValue.length > 0 ? labelsFor(WEEKEND_STYLE_OPTIONS, editTempMultiValue).join("، ") : "תפתיעו אותנו");
    } else if (editingStage === "pace") {
      if (!editTempValue) return;
      setForm((f) => ({ ...f, pace: editTempValue as WeekendAnswers["pace"] }));
      updateMessageLabel(labelFor(VACATION_PACE_OPTIONS, editTempValue));
    } else if (editingStage === "budget") {
      if (!editTempValue) return;
      setForm((f) => ({ ...f, budgetPerPerson: editTempValue }));
      updateMessageLabel(labelFor(WEEKEND_BUDGET_STEPS, editTempValue));
    } else {
      return;
    }

    closeEdit();
  }

  /**
   * מוצג בסוף השאלון (במקום לבנות ישר): הודעת בוט "בונים עבורך את
   * הסופ"ש המושלם" ואז בועת runtrippy עם הלוגו הדופק - הכל בתוך הצ'אט.
   * אותו עיקרון בדיוק כמו promptBuildTrip בחופשה בחו"ל: לחיצה ידנית על
   * הבועה = מעבר מיידי למסך הבנייה; בלי לחיצה - נשארים בצ'אט, בונים
   * ברקע, ועוברים ישר לעמוד המוכן ברגע שהמסלול מוכן.
   */
  function promptBuildTrip(next: WeekendAnswers) {
    pendingBuildAnswersRef.current = next;
    setReadyToBuild(true);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      addBot('בונים עבורך את הסופ"ש המושלם!');
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        addRuntrippyPrompt();
        autoBuildAndWaitThenNavigate(next);
      }, 700);
    }, 550);
  }

  function handleRuntrippyClick() {
    if (manualGameRequestedRef.current) return; // כבר נלחץ
    if (!pendingBuildAnswersRef.current) return;
    manualGameRequestedRef.current = true;
    buildTripDirectly(pendingBuildAnswersRef.current);
  }

  /**
   * יוצר session (פעם אחת בלבד - משותף בין שני הנתיבים דרך sessionPromiseRef)
   * ומפעיל auto-build ברקע.
   */
  function ensureSessionCreated(answers: WeekendAnswers): Promise<string> {
    if (!sessionPromiseRef.current) {
      sessionPromiseRef.current = createSessionAndStartBuild(answers);
    }
    return sessionPromiseRef.current;
  }

  async function buildTripDirectly(answers: WeekendAnswers) {
    if (!user) {
      router.push("/auth");
      return;
    }
    setSubmitting(true);
    setLocationError(null);
    try {
      const sessionId = await ensureSessionCreated(answers);
      if (navigatedToResultRef.current) return; // מרוץ נדיר: הנתיב האוטומטי כבר ניווט קודם
      navigatedToResultRef.current = true;
      // game=1 מסמן שהמעבר הזה קרה כתוצאה מלחיצה ידנית על בועת ה-runtrippy -
      // ההבדל היחיד שעמוד התוצאה מסתמך עליו כדי להחליט אם להציג את המשחק
      // המלא-מסך או מסך המתנה רגיל (ר' result/page.tsx).
      router.push(`/trip-builder/weekend/result?sessionId=${sessionId}&game=1`);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'לא הצלחנו לבנות את הסופ"ש. נסו שוב.');
      setSubmitting(false);
    }
  }

  /**
   * יוצר session ומפעיל auto-build ברקע - לוגיקה משותפת לשני נתיבי הבנייה
   * (לחיצה ידנית / אוטומטי-בלי-לחיצה). לא מנווט בעצמו - זו אחריות הקורא.
   */
  async function createSessionAndStartBuild(answers: WeekendAnswers): Promise<string> {
    const origin = await getCurrentPosition();
    const response = await fetch("/api/trip-builder/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripType: "weekend", answers, origin }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'יצירת הסופ"ש נכשלה');

    const sessionId = data.session.id;
    fetch(`/api/trip-builder/sessions/${sessionId}/auto-build`, { method: "POST" }).catch(() => {});
    return sessionId;
  }

  /**
   * בקשה מפורשת וחד-משמעית (אותו עיקרון בדיוק כמו חופשה בחו"ל): "רק
   * לחיצה על הלוגו מעבירה למסך הבנייה. אם לא לוחצים - נשארים בעמוד הזה
   * (הצ'אט) עד שהמסלול מוכן בפועל, תוך 10-15 שניות, ואז עוברים ישר
   * לעמוד המוכן - לא למסך טעינה/משחק."
   */
  async function autoBuildAndWaitThenNavigate(answers: WeekendAnswers) {
    if (!user) return; // לא מפנים ל-/auth בכפייה - ממתינים ללחיצה הידנית של המשתמש
    setLocationError(null);
    try {
      const sessionId = await ensureSessionCreated(answers);
      if (manualGameRequestedRef.current) return; // המשתמש כבר לחץ - buildTripDirectly מטפל בניווט

      const MAX_WAIT_MS = 20000;
      const POLL_INTERVAL_MS = 1200;
      const startedAt = Date.now();
      while (Date.now() - startedAt < MAX_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (manualGameRequestedRef.current) return; // נלחץ תוך כדי ההמתנה - עוצרים כאן
        try {
          const pollRes = await fetch(`/api/trip-builder/sessions?sessionId=${sessionId}`);
          const pollData = await pollRes.json();
          const session = pollData?.session;
          const hasAnyStops = (session?.final_itinerary?.stops?.length ?? 0) > 0;
          if (session?.status === "completed" || hasAnyStops) break;
        } catch {
          // שגיאת רשת חד-פעמית בתשאול - ממשיכים לנסות, לא עוצרים
        }
      }

      if (manualGameRequestedRef.current || navigatedToResultRef.current) return;
      navigatedToResultRef.current = true;
      router.push(`/trip-builder/weekend/result?sessionId=${sessionId}`);
    } catch (error) {
      // מאפשרים ניסיון נוסף (למשל לחיצה ידנית על הבועה) אם ההרשמה הראשונית נכשלה
      sessionPromiseRef.current = null;
      setLocationError(error instanceof Error ? error.message : 'לא הצלחנו לבנות את הסופ"ש. נסו שוב.');
    }
  }

  return (
    <Screen withBottomNavSpacing>
      <div className="-mx-5 -mt-8">
        <TripBuilderHeader current={1} total={1} onBack={() => router.push("/home")} />
      </div>

      <div className="mx-auto flex max-w-md flex-col gap-4 px-1 pt-4 pb-6">
        {messages.map((m) =>
          m.role === "assistant" ? (
            <ChatBubble key={m.id}>{m.text}</ChatBubble>
          ) : m.role === "runtrippy" ? (
            <RuntrippyPromptBubble key={m.id} onClick={handleRuntrippyClick} />
          ) : m.role === "icon" ? (
            <div key={m.id} className="flex items-end justify-end gap-2">
              <div
                className="flex items-center gap-2 rounded-pill px-3 py-2"
                style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
              >
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20">
                  <Image src="/images/categories/cat-weekend.png" alt="" fill className="object-cover" />
                </span>
                <span className="text-[13.5px] font-medium text-white">{m.text}</span>
              </div>
              <UserAvatar avatarUrl={profile?.avatar_url ?? null} name={profile?.full_name ?? null} />
            </div>
          ) : editingMessageId === m.id ? (
            <div key={m.id} className="mt-1">
              {editingStage === "companions" && (
                <ChipGroup options={VACATION_COMPANION_OPTIONS} selected={editTempMultiValue} onChange={setEditTempMultiValue} />
              )}
              {editingStage === "childAges" && (
                <ChipGroup options={VACATION_CHILD_AGE_OPTIONS} selected={editTempMultiValue} onChange={setEditTempMultiValue} />
              )}
              {editingStage === "dates" && (
                <DateRangePicker
                  startDate={editTempStartDate}
                  endDate={editTempEndDate}
                  onChange={(start, end) => {
                    setEditTempStartDate(start);
                    setEditTempEndDate(end);
                  }}
                />
              )}
              {editingStage === "freeIntent" && (
                <textarea
                  value={editTempFreeText}
                  onChange={(e) => setEditTempFreeText(e.target.value)}
                  rows={3}
                  className="w-full rounded-card border border-ink-secondary/25 bg-bg p-4 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              )}
              {editingStage === "distanceBand" && (
                <div className="rounded-card bg-white p-4 shadow-md">
                  <Slider steps={DISTANCE_STEPS} value={editTempValue ?? DISTANCE_STEPS[0].value} onChange={setEditTempValue} />
                </div>
              )}
              {editingStage === "bookedQuestion" && (
                <AnswerOptions
                  options={[
                    { value: "yes", label: "כן" },
                    { value: "no", label: "לא" },
                  ]}
                  selected={editTempValue}
                  onSelect={setEditTempValue}
                />
              )}
              {editingStage === "lodgingInfo" && (
                <Field label="שם המקום או כתובת">
                  <HotelAutocomplete
                    name={editTempLodgingName}
                    address={editTempLodgingAddress}
                    onChange={(name, address) => {
                      setEditTempLodgingName(name);
                      setEditTempLodgingAddress(address);
                    }}
                  />
                </Field>
              )}
              {editingStage === "lodgingType" && (
                <AnswerOptions options={LODGING_TYPE_OPTIONS} selected={editTempValue} onSelect={setEditTempValue} />
              )}
              {editingStage === "weekendStyles" && (
                <ChipGroup options={WEEKEND_STYLE_OPTIONS} selected={editTempMultiValue} onChange={setEditTempMultiValue} />
              )}
              {editingStage === "pace" && (
                <AnswerOptions options={VACATION_PACE_OPTIONS} selected={editTempValue} onSelect={setEditTempValue} />
              )}
              {editingStage === "budget" && (
                <div className="rounded-card bg-white p-4 shadow-md">
                  <Slider steps={WEEKEND_BUDGET_STEPS} value={editTempValue ?? WEEKEND_BUDGET_STEPS[0].value} onChange={setEditTempValue} />
                </div>
              )}

              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 rounded-pill border border-ink-secondary/25 bg-white py-2 text-sm font-medium text-ink-secondary shadow-md"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={confirmEdit}
                  className="flex-1 rounded-pill py-2 text-sm font-semibold text-white shadow-md"
                  style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
                >
                  עדכן
                </button>
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex items-end justify-end gap-2">
              <UserBubble onClick={m.editStage ? () => openEdit(m) : undefined}>{m.text}</UserBubble>
              <UserAvatar avatarUrl={profile?.avatar_url ?? null} name={profile?.full_name ?? null} />
            </div>
          )
        )}

        {typing && <TypingIndicator />}

        {!typing && !submitting && !readyToBuild && (
          <div className="mt-1">
            {stage === "dates" && (
              <DateRangePicker
                startDate={tempStartDate}
                endDate={tempEndDate}
                onChange={(start, end) => {
                  setTempStartDate(start);
                  setTempEndDate(end);
                }}
              />
            )}

            {stage === "freeIntent" && (
              <div className="flex flex-col gap-3">
                <textarea
                  value={tempFreeIntent}
                  onChange={(e) => setTempFreeIntent(e.target.value)}
                  placeholder="לדוגמה: רוצים הרבה טבע, מחפשים יקבים, חשוב לנו ספא..."
                  rows={3}
                  disabled={extractingIntent}
                  className="w-full rounded-card border border-ink-secondary/25 bg-bg p-4 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={confirmFreeIntentTogether}
                  disabled={!tempFreeIntent.trim() || extractingIntent}
                  className="w-full rounded-pill py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
                >
                  בואו נבנה יחד
                </button>
                <button
                  type="button"
                  onClick={confirmFreeIntentAlone}
                  disabled={!tempFreeIntent.trim() || extractingIntent}
                  className="w-full rounded-pill border border-accent/30 bg-accent/5 py-2 text-sm font-semibold text-accent disabled:opacity-50"
                >
                  אמשיך לבד
                </button>
              </div>
            )}

            {stage === "companions" && (
              <ChipGroup options={VACATION_COMPANION_OPTIONS} selected={tempCompanions} onChange={setTempCompanions} />
            )}

            {stage === "childAges" && (
              <ChipGroup options={VACATION_CHILD_AGE_OPTIONS} selected={tempChildAges} onChange={setTempChildAges} />
            )}

            {stage === "distanceBand" && (
              <div className="rounded-card bg-white p-4 shadow-md">
                <Slider steps={DISTANCE_STEPS} value={tempDistance ?? DISTANCE_STEPS[0].value} onChange={setTempDistance} />
              </div>
            )}

            {stage === "bookedQuestion" && (
              <AnswerOptions
                options={[
                  { value: "yes", label: "כן" },
                  { value: "no", label: "לא" },
                ]}
                selected={tempBooked}
                onSelect={setTempBooked}
              />
            )}

            {stage === "lodgingInfo" && (
              <Field label="שם המקום או כתובת">
                <HotelAutocomplete
                  name={tempLodgingName}
                  address={tempLodgingAddress}
                  onChange={(name, address) => {
                    setTempLodgingName(name);
                    setTempLodgingAddress(address);
                  }}
                />
              </Field>
            )}

            {stage === "lodgingType" && (
              <AnswerOptions options={LODGING_TYPE_OPTIONS} selected={tempLodgingType} onSelect={setTempLodgingType} />
            )}

            {stage === "budget" && (
              <div className="rounded-card bg-white p-4 shadow-md">
                <Slider steps={WEEKEND_BUDGET_STEPS} value={tempBudget ?? WEEKEND_BUDGET_STEPS[0].value} onChange={setTempBudget} />
              </div>
            )}

            {stage === "weekendStyles" && (
              <ChipGroup options={WEEKEND_STYLE_OPTIONS} selected={tempStyles} onChange={setTempStyles} />
            )}

            {stage === "pace" && (
              <AnswerOptions options={VACATION_PACE_OPTIONS} selected={tempPace} onSelect={setTempPace} />
            )}
          </div>
        )}

        {submitting && (
          <LoadingGame
            statusText='רגע, בונים לכם את הסופ"ש...'
            steps={[
              "🏡 מוצאים את אזור הלינה המושלם",
              "🏛️ בוחרים אטרקציות ופינות מיוחדות",
              "🍽️ מתאימים מסעדות לכל יום",
              "🗺️ בונים מסלול לפי אזורים וזמני נסיעה",
              "⏱️ מסדרים הכל לפי שעות פתיחה וקצב הטיול",
            ]}
          />
        )}

        {locationError && <p className="text-center text-sm text-danger">{locationError}</p>}

        {/* freeIntent לא משתמש בכפתור הגנרי הזה בכלל - יש לו שני כפתורים
            משלו (בואו נבנה יחד / אמשיך לבד) בתוך הבלוק של השלב עצמו. */}
        {!submitting && !typing && !readyToBuild && stage !== "freeIntent" && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => {
                if (stage === "dates") confirmDates();
                else if (stage === "companions") confirmCompanions();
                else if (stage === "childAges") confirmChildAges();
                else if (stage === "distanceBand") confirmDistance();
                else if (stage === "bookedQuestion") confirmBooked();
                else if (stage === "lodgingInfo") confirmLodgingInfo();
                else if (stage === "lodgingType") confirmLodgingType();
                else if (stage === "budget") confirmBudget();
                else if (stage === "weekendStyles") confirmStyles();
                else if (stage === "pace") confirmPace();
              }}
              disabled={
                (stage === "dates" && (!tempStartDate || !tempEndDate)) ||
                (stage === "companions" && tempCompanions.length === 0) ||
                (stage === "bookedQuestion" && !tempBooked) ||
                (stage === "lodgingInfo" && !tempLodgingName && !tempLodgingAddress) ||
                (stage === "lodgingType" && !tempLodgingType) ||
                (stage === "budget" && !tempBudget) ||
                (stage === "pace" && !tempPace)
              }
              className="w-full rounded-pill py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              המשך
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <MainBottomNav active="ai" />
    </Screen>
  );
}

function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return getCurrentPositionSafe("יש לאשר גישה למיקום ולנסות שוב");
}
