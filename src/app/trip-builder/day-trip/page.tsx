"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ChipGroup, Field, Screen, Slider } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureOnboardingGuard } from "@/hooks/useFeatureOnboardingGuard";
import { DAY_TRIP_QUESTIONS } from "@/services/tripBuilder/rules/dayTrip";
import type { ExtractedDayTripIntent } from "@/services/tripBuilder/dayTripIntentExtractionService";
import type { DayTripAnswers } from "@/services/tripBuilder/types";
import { TripBuilderHeader } from "@/screens/trip-builder/chat/TripBuilderHeader";
import { ChatBubble } from "@/screens/trip-builder/chat/ChatBubble";
import { UserBubble } from "@/screens/trip-builder/chat/UserBubble";
import { TypingIndicator } from "@/screens/trip-builder/chat/TypingIndicator";
import { AnswerOptions } from "@/screens/trip-builder/chat/AnswerOptions";
import { RuntrippyPromptBubble } from "@/screens/trip-builder/chat/RuntrippyPromptBubble";
import { MainBottomNav } from "@/components/MainBottomNav";
import Image from "next/image";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";

const DEFAULT_ANSWERS: DayTripAnswers = {
  companions: "solo",
  hasPet: false,
  childAgeBands: [],
  timing: "today",
  otherDate: null,
  distanceBand: "1h",
  budgetBand: "300-600",
  interests: [],
  durationBand: "half_day",
  freeText: "",
};

type EditableFieldKey =
  | "companions"
  | "childAgeBands"
  | "timing"
  | "distanceBand"
  | "budgetBand"
  | "interests"
  | "durationBand"
  | "freeText";

type ChatMessage = {
  id: number;
  role: "assistant" | "user" | "icon";
  text: string;
  fieldKey?: EditableFieldKey;
};

/** עיגול אווטאר קטן ליד כל הודעת משתמש — תמונת פרופיל אם קיימת, אחרת אות ראשונה. */
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

/** תג שמציג את סוג הטיול, בצד שמאל — כמו תשובות המשתמש, עם גרדיאנט המותג. */
function TripTypeBadge({ label }: { label: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="flex items-center gap-2 rounded-pill px-3 py-2"
        style={{
          background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))",
          boxShadow: "0 4px 12px rgba(24,119,242,0.28)",
        }}
      >
        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-white/40">
          <Image src="/images/day-trip-icon.png" alt="" fill className="object-cover" />
        </div>
        <span className="text-[13.5px] font-medium text-white">{label}</span>
      </div>
    </div>
  );
}

export default function DayTripQuestionnairePage() {
const router = useRouter();
  const { user, profile } = useAuth();
  const { ready } = useFeatureOnboardingGuard("tripbuilding", "/onboarding/chat");

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<DayTripAnswers>(DEFAULT_ANSWERS);
const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [awaitingChildAges, setAwaitingChildAges] = useState(false);
  const [awaitingOtherDate, setAwaitingOtherDate] = useState(false);
const [tempMulti, setTempMulti] = useState<string[]>([]);
  const [tempSlider, setTempSlider] = useState<string | null>(null);
  const [tempText, setTempText] = useState("");
const [tempCompanion, setTempCompanion] = useState<string | null>(null);
  const [tempHasPet, setTempHasPet] = useState(false);

  const [editingFieldKey, setEditingFieldKey] = useState<EditableFieldKey | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editTempValue, setEditTempValue] = useState<string | null>(null);
  const [editTempSlider, setEditTempSlider] = useState<string | null>(null);
  const [editTempMulti, setEditTempMulti] = useState<string[]>([]);
  const [editTempText, setEditTempText] = useState("");
  const [editTempCompanion, setEditTempCompanion] = useState<string | null>(null);
  const [editTempHasPet, setEditTempHasPet] = useState(false);
const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const startedRef = useRef(false);
  // בקשה מפורשת - אותה ארכיטקטורה בדיוק כמו חופשה בחו"ל: מלל חופשי
  // מיד אחרי "מתי יוצאים", חילוץ תשובות, ואז "בואו נבנה יחד"/"אמשיך לבד".
  const extractedIntentRef = useRef<ExtractedDayTripIntent | null>(null);
  const [showBuildChoice, setShowBuildChoice] = useState(false);
  const [waitingForBuild, setWaitingForBuild] = useState(false);
  const buildTriggeredRef = useRef(false);
  // תיקון באג אמיתי ("צריך שיהיה את הבועה בצ'אט... למה זה נעלם?") - זה
  // היה useRef, לא useState: קריאה ל-ref.current ישירות ב-JSX לא גורמת
  // ל-re-render כשהוא מתעדכן, כך שה-JSX תמיד "ראה" את הערך הראשוני (null) -
  // הבועה נראתה כאילו לא עושה כלום בלחיצה (או פשוט "נעלמה" מבחינה
  // פונקציונלית). state אמיתי מבטיח שה-UI יתעדכן ברגע שה-session נוצר.
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);


  const step = DAY_TRIP_QUESTIONS[stepIndex];
  const isLastStep = stepIndex === DAY_TRIP_QUESTIONS.length - 1;

  function nextId() {
    idRef.current += 1;
    return idRef.current;
  }
 function addBot(text: string, fieldKey?: EditableFieldKey) {
    setMessages((m) => [...m, { id: nextId(), role: "assistant", text, fieldKey }]);
  }
function addUser(text: string, fieldKey?: EditableFieldKey) {
    setMessages((m) => [...m, { id: nextId(), role: "user", text, fieldKey }]);
  }
  function addIconBadge(label: string) {
    setMessages((m) => [...m, { id: nextId(), role: "icon", text: label }]);
  }

  // מציג את הודעת הפתיחה, את תג סוג הטיול, ואז את השאלה הראשונה — פעם אחת כשהעמוד נטען
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    addBot(
      "שלום! אני טריפי AI 👋\nסוכן ה-AI האישי של TRIPLACE.\nאני כאן כדי להכיר אתכם, להבין בדיוק מה אתם מחפשים, ולבנות עבורכם חופשה שתוכננה במיוחד בשבילכם — מהיעדים ועד המסלול המושלם.\nאז בואו נתחיל!"
    );
    addIconBadge("טיול יומי");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      addBot(DAY_TRIP_QUESTIONS[0].title);
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);


  function updateField<K extends keyof DayTripAnswers>(key: K, value: DayTripAnswers[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function labelFor(options: { value: string; label: string }[] | undefined, value: string) {
    return options?.find((o) => o.value === value)?.label ?? value;
  }

  function labelsFor(options: { value: string; label: string }[] | undefined, values: string[]) {
    return values.map((v) => labelFor(options, v));
  }

function resetTempAnswerState() {
    setTempMulti([]);
    setTempSlider(null);
    setTempText("");
    setTempCompanion(null);
    setTempHasPet(false);
    setAwaitingChildAges(false);
    setAwaitingOtherDate(false);
  }

function goToNextStep() {
    resetTempAnswerState();
    if (isLastStep) {
      createSessionAndWaitThenNavigate(form);
      return;
    }
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setStepIndex((i) => i + 1); // pure state update only — no side effects here
    }, 550);
  }

  // מוסיף את בועת הבוט של השאלה החדשה כשה-step משתנה בפועל — מקום יחיד
  // ואמין לתופעת הלוואי הזו, כדי שלא "תרוץ פעמיים" בטעות
  useEffect(() => {
    if (stepIndex === 0) return; // השאלה הראשונה כבר נוספה ב-mount
    addBot(DAY_TRIP_QUESTIONS[stepIndex].title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // ---------- מטפלים בתשובה, לפי סוג השאלה הנוכחית ----------

function handleCompanionsSelect(value: string) {
    setTempCompanion(value);
  }

  function togglePet() {
    setTempHasPet((v) => !v);
  }

  function confirmCompanions() {
    if (step.type !== "companions" || !tempCompanion) return;
    updateField("companions", tempCompanion as DayTripAnswers["companions"]);
    updateField("hasPet", tempHasPet);

const label = labelFor(step.options, tempCompanion);
    addUser(tempHasPet ? `${label} · 🐶 עם בעל חיים` : label, "companions");

    if (tempCompanion === step.childAgeTriggerValue) {
      setAwaitingChildAges(true);
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        addBot(step.childAgeTitle, "childAgeBands");
      }, 500);
      return;
    }
    goToNextStep();
  }

function confirmChildAges() {
    if (step.type !== "companions") return;
    updateField("childAgeBands", tempMulti as DayTripAnswers["childAgeBands"]);
    addUser(
      tempMulti.length > 0 ? labelsFor(step.childAgeOptions, tempMulti).join("، ") : "לא רלוונטי",
      "childAgeBands"
    );
    goToNextStep();
  }

  function handleDateSelect(value: string) {
if (step.type !== "date") return;
    updateField("timing", value as DayTripAnswers["timing"]);
    const label = labelFor(step.options, value);
    addUser(label, "timing");

    if (value === step.otherDateTriggerValue) {
      setAwaitingOtherDate(true);
      return;
    }
    goToNextStep();
  }

  function confirmOtherDate() {
    if (!tempText) return;
    updateField("otherDate", tempText);
    addUser(tempText);
    goToNextStep();
  }

  function confirmSlider() {
    if (step.type !== "slider") return;
const value = tempSlider ?? (form[step.key as keyof DayTripAnswers] as string) ?? step.steps[0];
    updateField(step.key as keyof DayTripAnswers, value as never);
    const label = labelFor(step.steps as unknown as { value: string; label: string }[], value);
    addUser(label, step.key as EditableFieldKey);
    goToNextStep();
  }

  function confirmInterests() {
if (step.type !== "multi-emoji") return;
    updateField("interests", tempMulti);
    addUser(tempMulti.length > 0 ? labelsFor(step.options, tempMulti).join("، ") : "לא משנה לי", "interests");
    goToNextStep();
  }

  function handleSingleSelect(value: string) {
if (step.type !== "single") return;
    updateField(step.key as keyof DayTripAnswers, value as never);
    const label = labelFor(step.options, value);
    addUser(label, step.key as EditableFieldKey);
    goToNextStep();
  }

  function getEditQuestionTitle(key: EditableFieldKey): string {
    if (key === "childAgeBands") {
      const companionsStep = DAY_TRIP_QUESTIONS.find((q) => q.key === "companions");
      return companionsStep && companionsStep.type === "companions" ? companionsStep.childAgeTitle : "";
    }
    const editStep = DAY_TRIP_QUESTIONS.find((q) => q.key === key);
    return editStep?.title ?? "";
  }

  function openEdit(message: ChatMessage) {
    if (!message.fieldKey || typing || submitting || editingFieldKey) return;
    const key = message.fieldKey;
    setEditingFieldKey(key);
    setEditingMessageId(message.id);

if (key === "companions") {
      setEditTempCompanion(form.companions);
      setEditTempHasPet(form.hasPet);
    } else if (key === "childAgeBands" || key === "interests") {
      setEditTempMulti(key === "childAgeBands" ? form.childAgeBands : form.interests);
    } else if (key === "distanceBand" || key === "budgetBand") {
      setEditTempSlider(form[key] as string);
    } else if (key === "freeText") {
      setEditTempText(form.freeText);
    } else if (key === "timing") {
      setEditTempValue(form.timing);
      setEditTempText(form.otherDate ?? "");
    } else {
      setEditTempValue(form[key] as string);
    }
  }

  function closeEdit() {
    setEditingFieldKey(null);
    setEditingMessageId(null);
    setEditTempValue(null);
    setEditTempSlider(null);
    setEditTempMulti([]);
    setEditTempText("");
    setEditTempCompanion(null);
    setEditTempHasPet(false);
  }

  function confirmEdit() {
    if (!editingFieldKey || editingMessageId == null) return;
const key = editingFieldKey;
    const editStep = DAY_TRIP_QUESTIONS.find((q) => q.key === (key === "childAgeBands" ? "companions" : key));
    if (!editStep) return;

    let newLabel = "";

if (key === "companions" && editStep.type === "companions") {
      if (!editTempCompanion) return;
      updateField("companions", editTempCompanion as DayTripAnswers["companions"]);
      updateField("hasPet", editTempHasPet);
      const label = labelFor(editStep.options, editTempCompanion);
      newLabel = editTempHasPet ? `${label} · 🐶 עם בעל חיים` : label;

      // אם עברו מ"משפחה עם ילדים" לאופציה אחרת - שאלת/תשובת הגילאים כבר לא רלוונטית, מוחקים אותה
      if (editTempCompanion !== editStep.childAgeTriggerValue) {
        updateField("childAgeBands", [] as DayTripAnswers["childAgeBands"]);
        setMessages((msgs) => msgs.filter((m) => m.fieldKey !== "childAgeBands"));
      }
} else if (key === "timing" && editStep.type === "date") {
      if (!editTempValue) return;
      if (editTempValue === editStep.otherDateTriggerValue) {
        if (!editTempText) return;
        updateField("timing", editTempValue as DayTripAnswers["timing"]);
        updateField("otherDate", editTempText);
        newLabel = editTempText;
      } else {
        updateField("timing", editTempValue as DayTripAnswers["timing"]);
        newLabel = labelFor(editStep.options, editTempValue);
      }
    } else if ((key === "distanceBand" || key === "budgetBand") && editStep.type === "slider") {
      const value = editTempSlider ?? (form[key] as string);
      updateField(key, value as never);
      newLabel = labelFor(editStep.steps as unknown as { value: string; label: string }[], value);
} else if (key === "interests" && editStep.type === "multi-emoji") {
      updateField("interests", editTempMulti);
      newLabel = editTempMulti.length > 0 ? labelsFor(editStep.options, editTempMulti).join("، ") : "לא משנה לי";
    } else if (key === "childAgeBands" && editStep.type === "companions") {
      updateField("childAgeBands", editTempMulti as DayTripAnswers["childAgeBands"]);
      newLabel = editTempMulti.length > 0 ? labelsFor(editStep.childAgeOptions, editTempMulti).join("، ") : "לא רלוונטי";
    } else if (key === "durationBand" && editStep.type === "single") {
      if (!editTempValue) return;
      updateField("durationBand", editTempValue as DayTripAnswers["durationBand"]);
      newLabel = labelFor(editStep.options, editTempValue);
    } else if (key === "freeText") {
      updateField("freeText", editTempText);
      newLabel = editTempText || "—";
    }

    setMessages((msgs) => msgs.map((m) => (m.id === editingMessageId ? { ...m, text: newLabel } : m)));
    closeEdit();
  }

/**
   * בקשה מפורשת - המלל החופשי כבר לא בונה ישר (הוא כבר לא השאלה
   * האחרונה) - הוא מפעיל חילוץ (כמו parse-intent בחופשה בחו"ל) ואז מציג
   * שתי אפשרויות: "בואו נבנה יחד" (ממשיך לשאול את מה שלא כוסה) או
   * "אמשיך לבד" (בונה ישר לפי DNA/גנרי).
   */
  async function confirmFreeText() {
    const finalForm = { ...form, freeText: tempText };
    setForm(finalForm);
    addUser(tempText || "—", "freeText");
    resetTempAnswerState();
    setTyping(true);
    extractedIntentRef.current = await fetchExtractedDayTripIntent(tempText);
    setTyping(false);
    setShowBuildChoice(true);
  }

  async function fetchExtractedDayTripIntent(freeText: string): Promise<ExtractedDayTripIntent | null> {
    try {
      const res = await fetch("/api/trip-builder/day-trip/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeText }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.extracted as ExtractedDayTripIntent) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * "בואו נבנה יחד" - ממשיך משאלת freeText (index 1) קדימה, ומדלג
   * אוטומטית (עם בועת משתמש, בדיוק כאילו נענתה) על כל שאלה שכבר כוסתה
   * בחילוץ - עד לשאלה הראשונה שלא כוסתה, שם עוצר ומציג אותה אינטראקטיבית.
   * אם הכל כוסה - עובר ישר לבנייה.
   */
  function confirmBuildTogether() {
    setShowBuildChoice(false);
    addUser("בואו נבנה יחד", "freeText");
    advanceDayTrip(2, form);
  }

  function advanceDayTrip(fromIndex: number, current: DayTripAnswers) {
    const extracted = extractedIntentRef.current;
    let idx = fromIndex;
    let workingForm = current;

    while (extracted && idx < DAY_TRIP_QUESTIONS.length) {
      const s = DAY_TRIP_QUESTIONS[idx];

      if (s.type === "companions" && extracted.companions) {
        workingForm = { ...workingForm, companions: extracted.companions, hasPet: extracted.hasPet };
        const label = labelFor(s.options, extracted.companions);
        addUser(extracted.hasPet ? `${label} · 🐶 עם בעל חיים` : label, "companions");
        if (extracted.companions === s.childAgeTriggerValue) {
          if (extracted.childAgeBands.length > 0) {
            workingForm = { ...workingForm, childAgeBands: extracted.childAgeBands as DayTripAnswers["childAgeBands"] };
            addUser(labelsFor(s.childAgeOptions, extracted.childAgeBands).join("، "), "childAgeBands");
          } else {
            // גילאי ילדים לא חולצו מהמלל - חייבים לשאול את זה אינטראקטיבית.
            setForm(workingForm);
            setStepIndex(idx);
            setAwaitingChildAges(true);
            setTyping(true);
            setTimeout(() => {
              setTyping(false);
              addBot(s.childAgeTitle, "childAgeBands");
            }, 500);
            return;
          }
        }
        idx += 1;
        continue;
      }

      if (s.type === "slider" && s.key === "distanceBand" && extracted.distanceBand) {
        workingForm = { ...workingForm, distanceBand: extracted.distanceBand as DayTripAnswers["distanceBand"] };
        addUser(labelFor(s.steps, extracted.distanceBand), "distanceBand");
        idx += 1;
        continue;
      }

      if (s.type === "slider" && s.key === "budgetBand" && extracted.budgetBand) {
        workingForm = { ...workingForm, budgetBand: extracted.budgetBand as DayTripAnswers["budgetBand"] };
        addUser(labelFor(s.steps, extracted.budgetBand), "budgetBand");
        idx += 1;
        continue;
      }

      if (s.type === "multi-emoji" && extracted.interests.length > 0) {
        workingForm = { ...workingForm, interests: extracted.interests as DayTripAnswers["interests"] };
        addUser(labelsFor(s.options, extracted.interests).join("، "), "interests");
        idx += 1;
        continue;
      }

      if (s.type === "single" && s.key === "durationBand" && extracted.durationBand) {
        workingForm = { ...workingForm, durationBand: extracted.durationBand as DayTripAnswers["durationBand"] };
        addUser(labelFor(s.options, extracted.durationBand), "durationBand");
        idx += 1;
        continue;
      }

      break; // השאלה הזו לא כוסתה בחילוץ - עוצרים כאן
    }

    setForm(workingForm);

    if (idx >= DAY_TRIP_QUESTIONS.length) {
      createSessionAndWaitThenNavigate(workingForm);
      return;
    }

    resetTempAnswerState();
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setStepIndex(idx);
    }, 500);
  }

  /**
   * "אמשיך לבד" - בונה ישר, עם interests מה-DNA (אם קיים) או ברירות
   * המחדל הגנריות לכל שאר השדות - בלי לשאול שום שאלה נוספת.
   */
  async function confirmBuildAlone() {
    setShowBuildChoice(false);
    addUser("אמשיך לבד", "freeText");
    setTyping(true);
    let finalForm = form;
    try {
      const res = await fetch("/api/trip-builder/day-trip/dna-defaults");
      const data = await res.json();
      if (Array.isArray(data.interests) && data.interests.length > 0) {
        finalForm = { ...finalForm, interests: data.interests };
      }
    } catch {
      // נכשל - ממשיכים עם ברירות המחדל הגנריות הרגילות (DEFAULT_ANSWERS), לא חוסם
    }
    setForm(finalForm);
    setTyping(false);
    createSessionAndWaitThenNavigate(finalForm);
  }

  // ---------- שליחה סופית ----------

  /**
   * בקשה מפורשת (בדיוק כמו חופשה בחו"ל) - לא קופצים למסך המשחק (LoadingGame)
   * אוטומטית: נשארים כאן בצ'אט, בונים ברקע, ומתשאלים עד שהמסלול מוכן (או
   * עד תקרה בטיחותית של 20 שניות) - ואז עוברים ישר לעמוד המוכן.
   */
  async function createSessionAndWaitThenNavigate(answers: DayTripAnswers) {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (buildTriggeredRef.current) return;
    buildTriggeredRef.current = true;
    setLocationError(null);
    setWaitingForBuild(true);
    try {
      const origin = await getCurrentPosition();
      const response = await fetch("/api/trip-builder/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripType: "day_trip", answers, origin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "יצירת הטיול נכשלה");

      const sessionId = data.session.id;
      setPendingSessionId(sessionId);
      fetch(`/api/trip-builder/sessions/${sessionId}/auto-build`, { method: "POST" }).catch(() => {});

      // בקשה מפורשת: לא מנווטים בכוח אחרי X שניות גם אם הטיול עוד לא מוכן -
      // זה בדיוק מה שגרם למסך הביניים הממותג (BuildingTripIntro, "רשת
      // ביטחון" בעמוד התוצאה) לקפוץ למשתמש. נשארים כאן בצ'אט (עם הגרפיקה
      // בבועה, ר' waitingForBuild) ומתשאלים בלי הפסקה עד שהמסלול באמת
      // מוכן - ורק אז מנווטים. POLL_SLOW_AFTER_MS מאט את קצב התשאול אחרי
      // המתנה ארוכה במיוחד, כדי לא להציף שרת על session שתקוע.
      const POLL_INTERVAL_MS = 1200;
      const POLL_SLOW_AFTER_MS = 30000;
      const POLL_INTERVAL_SLOW_MS = 4000;
      // רשת ביטחון בלבד למקרה קיצון (למשל השרת לא זמין בכלל) - לא תקרה
      // רגילה לניווט. אם מגיעים לזה, לא מנווטים לשום מקום - נשארים בצ'אט
      // ומראים שגיאה עם אפשרות לנסות שוב.
      const HARD_GIVE_UP_MS = 90000;
      const startedAt = Date.now();
      let gaveUp = false;
      while (Date.now() - startedAt < HARD_GIVE_UP_MS) {
        const elapsed = Date.now() - startedAt;
        await new Promise((resolve) => setTimeout(resolve, elapsed > POLL_SLOW_AFTER_MS ? POLL_INTERVAL_SLOW_MS : POLL_INTERVAL_MS));
        try {
          const pollRes = await fetch(`/api/trip-builder/sessions?sessionId=${sessionId}`);
          const pollData = await pollRes.json();
          const s = pollData?.session;
          const hasStops = (s?.final_itinerary?.stops?.length ?? 0) > 0;
          if (s?.status === "completed" || hasStops) {
            router.push(`/trip-builder/day-trip/result?sessionId=${sessionId}`);
            return;
          }
        } catch {
          // שגיאת רשת חד-פעמית בתשאול - ממשיכים לנסות
        }
      }
      gaveUp = true;
      if (gaveUp) {
        buildTriggeredRef.current = false;
        setWaitingForBuild(false);
        setLocationError("זה לוקח יותר זמן מהרגיל. אפשר לנסות שוב.");
      }
    } catch (error) {
      buildTriggeredRef.current = false;
      setWaitingForBuild(false);
      setLocationError(
        error instanceof Error ? error.message : "לא הצלחנו לבנות את הטיול. יש לאשר גישה למיקום ולנסות שוב."
      );
    }
  }

  function getFooterAction(): { label: string; onClick: () => void; disabled?: boolean } | null {
    if (typing || submitting || showBuildChoice || waitingForBuild) return null;
    if (step.type === "companions" && awaitingChildAges) {
      return { label: "המשך", onClick: confirmChildAges };
    }
    if (step.type === "companions" && !awaitingChildAges) {
      return { label: "המשך", onClick: confirmCompanions, disabled: !tempCompanion };
    }
    if (step.type === "date" && awaitingOtherDate) {
      return { label: "המשך", onClick: confirmOtherDate, disabled: !tempText };
    }
    if (step.type === "slider") {
      return { label: "בחרתי", onClick: confirmSlider };
    }
    if (step.type === "multi-emoji") {
      return { label: "המשך", onClick: confirmInterests };
    }
    if (step.type === "text") {
      return { label: "המשך", onClick: confirmFreeText };
    }
    return null;
  }

const footerAction = getFooterAction();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [footerAction, editingFieldKey]);

  if (!ready) return null;

  return (
    <Screen withBottomNavSpacing>
            <div className="-mx-5 -mt-8">
<TripBuilderHeader current={stepIndex + 1} total={DAY_TRIP_QUESTIONS.length} onBack={() => router.push("/home")} />
        </div>

<div className="mx-auto flex max-w-md flex-col gap-4 px-1 pt-4 pb-6">
        {messages.map((m) => {
          if (editingFieldKey && m.id === editingMessageId) {
            return (
              <div key={m.id} className="mt-1">
                {editingFieldKey === "companions" &&
                  (() => {
                    const editStep = DAY_TRIP_QUESTIONS.find((q) => q.key === "companions");
                    if (!editStep || editStep.type !== "companions") return null;
                    return (
                      <div className="flex flex-col gap-3">
                        <AnswerOptions options={editStep.options} selected={editTempCompanion} onSelect={setEditTempCompanion} />
                        <button
                          type="button"
                          onClick={() => setEditTempHasPet((v) => !v)}
                          className="flex w-fit items-center gap-1.5 rounded-pill border px-3.5 py-2 text-[13px] font-medium transition active:scale-95"
                          style={{
                            borderColor: "#9C6B30",
                            background: editTempHasPet ? "#9C6B30" : "#ffffff",
                            color: editTempHasPet ? "#ffffff" : "#9C6B30",
                          }}
                        >
                          🐶 עם בעל חיים
                        </button>
                      </div>
                    );
                  })()}

                {editingFieldKey === "childAgeBands" &&
                  (() => {
                    const companionsStep = DAY_TRIP_QUESTIONS.find((q) => q.key === "companions");
                    if (!companionsStep || companionsStep.type !== "companions") return null;
                    return (
                      <ChipGroup options={companionsStep.childAgeOptions} selected={editTempMulti} onChange={setEditTempMulti} />
                    );
                  })()}

           {editingFieldKey === "timing" &&
                  (() => {
                    const editStep = DAY_TRIP_QUESTIONS.find((q) => q.key === "timing");
                    if (!editStep || editStep.type !== "date") return null;
                    return (
                      <div className="flex flex-col gap-3">
                        <AnswerOptions options={editStep.options} selected={editTempValue} onSelect={setEditTempValue} />
                        {editTempValue === editStep.otherDateTriggerValue && (
                          <Field label="בחר תאריך">
                            <input
                              type="date"
                              value={editTempText}
                              min={new Date().toISOString().split("T")[0]}
                              onChange={(e) => setEditTempText(e.target.value)}
                              className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
                            />
                          </Field>
                        )}
                      </div>
                    );
                  })()}

                {(editingFieldKey === "distanceBand" || editingFieldKey === "budgetBand") &&
                  (() => {
                    const editStep = DAY_TRIP_QUESTIONS.find((q) => q.key === editingFieldKey);
                    if (!editStep || editStep.type !== "slider") return null;
                    return (
                      <Slider
                        steps={editStep.steps}
                        value={editTempSlider ?? (form[editingFieldKey] as string)}
                        onChange={setEditTempSlider}
                      />
                    );
                  })()}

                {editingFieldKey === "interests" &&
                  (() => {
                    const editStep = DAY_TRIP_QUESTIONS.find((q) => q.key === "interests");
                    if (!editStep || editStep.type !== "multi-emoji") return null;
                    return <ChipGroup options={editStep.options} selected={editTempMulti} onChange={setEditTempMulti} />;
                  })()}

                {editingFieldKey === "durationBand" &&
                  (() => {
                    const editStep = DAY_TRIP_QUESTIONS.find((q) => q.key === "durationBand");
                    if (!editStep || editStep.type !== "single") return null;
                    return <AnswerOptions options={editStep.options} selected={editTempValue} onSelect={setEditTempValue} />;
                  })()}

        {editingFieldKey === "freeText" && (
                  <textarea
                    value={editTempText}
                    onChange={(e) => setEditTempText(e.target.value)}
                    rows={3}
                    className="w-full rounded-card border border-ink-secondary/25 bg-bg p-4 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
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
            );
          }

return m.role === "assistant" ? (
            <ChatBubble key={m.id}>{m.text}</ChatBubble>
          ) : m.role === "icon" ? (
            <div key={m.id} className="flex items-end justify-end gap-2">
              <TripTypeBadge label={m.text} />
              <UserAvatar avatarUrl={profile?.avatar_url ?? null} name={profile?.full_name ?? null} />
            </div>
          ) : (
            <div key={m.id} className="flex items-end justify-end gap-2">
              <UserBubble onClick={m.fieldKey ? () => openEdit(m) : undefined}>{m.text}</UserBubble>
              <UserAvatar avatarUrl={profile?.avatar_url ?? null} name={profile?.full_name ?? null} />
            </div>
          );
        })}

        {!editingFieldKey && typing && <TypingIndicator />}

 {!editingFieldKey && !typing && !submitting && (
       <div className="mt-1">
            {step.type === "companions" && !awaitingChildAges && (
              <div className="flex flex-col gap-3">
                <AnswerOptions options={step.options} selected={tempCompanion} onSelect={handleCompanionsSelect} />
                <button
                  type="button"
                  onClick={togglePet}
                  className="flex w-fit items-center gap-1.5 rounded-pill border px-3.5 py-2 text-[13px] font-medium transition active:scale-95"
                  style={{
                    borderColor: "#9C6B30",
                    background: tempHasPet ? "#9C6B30" : "#ffffff",
                    color: tempHasPet ? "#ffffff" : "#9C6B30",
                  }}
                >
                  🐶 עם בעל חיים
                </button>
              </div>
            )}
            {step.type === "companions" && awaitingChildAges && (
              <ChipGroup options={step.childAgeOptions} selected={tempMulti} onChange={setTempMulti} />
            )}

            {step.type === "date" && !awaitingOtherDate && (
              <AnswerOptions options={step.options} onSelect={handleDateSelect} />
            )}
            {step.type === "date" && awaitingOtherDate && (
              <Field label="בחר תאריך">
                <input
                  type="date"
                  value={tempText}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setTempText(e.target.value)}
                  className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </Field>
            )}

            {step.type === "slider" && (
              <div className="rounded-card bg-white p-4 shadow-md">
                <Slider
                  steps={step.steps}
                  value={tempSlider ?? (form[step.key as keyof DayTripAnswers] as string)}
                  onChange={(value) => setTempSlider(value)}
                />
              </div>
            )}

            {step.type === "multi-emoji" && (
              <ChipGroup options={step.options} selected={tempMulti} onChange={setTempMulti} />
            )}

            {step.type === "single" && (
              <AnswerOptions options={step.options} onSelect={handleSingleSelect} />
            )}

            {step.type === "text" && !showBuildChoice && !typing && !waitingForBuild && (
              <textarea
                value={tempText}
                onChange={(e) => setTempText(e.target.value)}
                placeholder={step.placeholder}
                rows={3}
                className="w-full rounded-card border border-ink-secondary/25 bg-bg p-4 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            )}
          </div>
        )}

        {/* בקשה מפורשת - בדיוק כמו חופשה בחו"ל: אחרי המלל החופשי, שתי
            אפשרויות - להמשיך לענות על מה שלא כוסה, או לבנות ישר. */}
        {showBuildChoice && (
          <div className="flex flex-col gap-2 px-1">
            <button
              type="button"
              onClick={confirmBuildTogether}
              className="w-full rounded-pill py-3 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              בואו נבנה יחד
            </button>
            <button
              type="button"
              onClick={confirmBuildAlone}
              className="w-full rounded-pill border border-accent/30 bg-accent/5 py-3 text-sm font-semibold text-accent"
            >
              אמשיך לבד
            </button>
          </div>
        )}

        {/* בקשה מפורשת ("10-15 שניות, עם הטעינה שלנו, לא המשחק") - נשארים
            כאן בצ'אט בזמן שהטיול נבנה ברקע, בלי לקפוץ למסך משחק נפרד. */}
        {waitingForBuild && (
          <div className="flex flex-col gap-2">
            <ChatBubble>
              <div className="flex items-center gap-3">
                <div
                  className="relative h-9 w-9 shrink-0"
                  style={{ animation: "dayTripBuildingPulse 2.6s ease-in-out infinite" }}
                >
                  <Image src="/images/game/runtrippy-logo.png" alt="" fill className="object-contain" />
                </div>
                <span>רגע, בונים לכם את הטיול...</span>
              </div>
            </ChatBubble>
            {pendingSessionId && (
              <RuntrippyPromptBubble
                onClick={() => {
                  router.push(`/trip-builder/day-trip/result?sessionId=${pendingSessionId}`);
                }}
              />
            )}
            <style jsx>{`
              @keyframes dayTripBuildingPulse {
                0%,
                100% {
                  transform: scale(0.88);
                }
                50% {
                  transform: scale(1.08);
                }
              }
            `}</style>
          </div>
        )}

{locationError && <p className="text-center text-sm text-danger">{locationError}</p>}

 {!editingFieldKey && !submitting && !showBuildChoice && !waitingForBuild && footerAction && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={footerAction.onClick}
              disabled={footerAction.disabled}
              className="w-full rounded-pill py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              {footerAction.label}
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
  return getCurrentPositionSafe("יש לאשר גישה למיקום כדי לבנות טיול קרוב אליכם");
}
