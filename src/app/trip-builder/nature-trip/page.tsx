"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ChipGroup, Field, Screen, Slider } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { NATURE_TRIP_QUESTIONS } from "@/services/tripBuilder/rules/natureTrip";
import type { ExtractedNatureTripIntent } from "@/services/tripBuilder/natureTripIntentExtractionService";
import type { NatureTripAnswers } from "@/services/tripBuilder/types";
import { TripBuilderHeader } from "@/screens/trip-builder/chat/TripBuilderHeader";
import { ChatBubble } from "@/screens/trip-builder/chat/ChatBubble";
import { UserBubble } from "@/screens/trip-builder/chat/UserBubble";
import { TypingIndicator } from "@/screens/trip-builder/chat/TypingIndicator";
import { AnswerOptions } from "@/screens/trip-builder/chat/AnswerOptions";
import { RuntrippyPromptBubble } from "@/screens/trip-builder/chat/RuntrippyPromptBubble";
import { MainBottomNav } from "@/components/MainBottomNav";
import Image from "next/image";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";

const DEFAULT_ANSWERS: NatureTripAnswers = {
  companions: "solo",
  hasPet: false,
  childAgeBands: [],
  timing: "today",
  otherDate: null,
  distanceBand: "1h",
  budgetBand: "300-600",
  natureTypes: [],
  difficulty: "easy",
  durationBand: "half_day",
  customDuration: null,
  freeText: "",
};

type EditableFieldKey =
  | "companions"
  | "childAgeBands"
  | "timing"
  | "distanceBand"
  | "budgetBand"
  | "natureTypes"
  | "difficulty"
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
          <Image src="/images/categories/cat-nature.png" alt="" fill className="object-cover" />
        </div>
        <span className="text-[13.5px] font-medium text-white">{label}</span>
      </div>
    </div>
  );
}

export default function NatureTripQuestionnairePage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<NatureTripAnswers>(DEFAULT_ANSWERS);
  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [awaitingChildAges, setAwaitingChildAges] = useState(false);
  const [awaitingOtherDate, setAwaitingOtherDate] = useState(false);
  const [awaitingCustomDuration, setAwaitingCustomDuration] = useState(false);
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
  // בקשה מפורשת - אותה ארכיטקטורה בדיוק כמו טיול יומי/חופשה בחו"ל.
  const extractedIntentRef = useRef<ExtractedNatureTripIntent | null>(null);
  const [showBuildChoice, setShowBuildChoice] = useState(false);
  const [waitingForBuild, setWaitingForBuild] = useState(false);
  const buildTriggeredRef = useRef(false);
  // תיקון באג אמיתי - היה useRef (לא מרנדר מחדש כשמתעדכן, ר' אותה הערה
  // בטיול יומי) - עכשיו state אמיתי.
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  const step = NATURE_TRIP_QUESTIONS[stepIndex];
  const isLastStep = stepIndex === NATURE_TRIP_QUESTIONS.length - 1;

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
      "שלום! אני טריפי AI 👋\nסוכן ה-AI האישי של TRIPLACE.\nאני כאן כדי להכיר אתכם, להבין בדיוק מה אתם מחפשים, ולבנות עבורכם יום טבע שתוכנן במיוחד בשבילכם.\nאז בואו נתחיל!"
    );
    addIconBadge("טיול בטבע");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      addBot(NATURE_TRIP_QUESTIONS[0].title);
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  function updateField<K extends keyof NatureTripAnswers>(key: K, value: NatureTripAnswers[K]) {
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
    setAwaitingCustomDuration(false);
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
    addBot(NATURE_TRIP_QUESTIONS[stepIndex].title);
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
    updateField("companions", tempCompanion as NatureTripAnswers["companions"]);
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
    updateField("childAgeBands", tempMulti as NatureTripAnswers["childAgeBands"]);
    addUser(
      tempMulti.length > 0 ? labelsFor(step.childAgeOptions, tempMulti).join("، ") : "לא רלוונטי",
      "childAgeBands"
    );
    goToNextStep();
  }

  function handleDateSelect(value: string) {
    if (step.type !== "date") return;
    updateField("timing", value as NatureTripAnswers["timing"]);
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
    const value = tempSlider ?? (form[step.key as keyof NatureTripAnswers] as string) ?? step.steps[0];
    updateField(step.key as keyof NatureTripAnswers, value as never);
    const label = labelFor(step.steps as unknown as { value: string; label: string }[], value);
    addUser(label, step.key as EditableFieldKey);
    goToNextStep();
  }

  function confirmNatureTypes() {
    if (step.type !== "multi-emoji") return;
    updateField("natureTypes", tempMulti);
    addUser(tempMulti.length > 0 ? labelsFor(step.options, tempMulti).join("، ") : "לא משנה לי", "natureTypes");
    goToNextStep();
  }

  /** מטפל בבחירת "single": difficulty רגיל, אבל durationBand="custom" פותח שדה טקסט חופשי לפני שממשיכים. */
  function handleSingleSelect(value: string) {
    if (step.type !== "single") return;
    updateField(step.key as keyof NatureTripAnswers, value as never);
    const label = labelFor(step.options, value);
    addUser(label, step.key as EditableFieldKey);

    if (step.key === "durationBand" && value === "custom") {
      setAwaitingCustomDuration(true);
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        addBot("איזה משך זמן בדיוק בא לכם?", "durationBand");
      }, 500);
      return;
    }
    goToNextStep();
  }

  function confirmCustomDuration() {
    if (!tempText) return;
    updateField("customDuration", tempText);
    addUser(tempText, "durationBand");
    goToNextStep();
  }

  function getEditQuestionTitle(key: EditableFieldKey): string {
    if (key === "childAgeBands") {
      const companionsStep = NATURE_TRIP_QUESTIONS.find((q) => q.key === "companions");
      return companionsStep && companionsStep.type === "companions" ? companionsStep.childAgeTitle : "";
    }
    const editStep = NATURE_TRIP_QUESTIONS.find((q) => q.key === key);
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
    } else if (key === "childAgeBands" || key === "natureTypes") {
      setEditTempMulti(key === "childAgeBands" ? form.childAgeBands : form.natureTypes);
    } else if (key === "distanceBand" || key === "budgetBand") {
      setEditTempSlider(form[key] as string);
    } else if (key === "freeText") {
      setEditTempText(form.freeText);
    } else if (key === "timing") {
      setEditTempValue(form.timing);
      setEditTempText(form.otherDate ?? "");
    } else if (key === "durationBand") {
      setEditTempValue(form.durationBand);
      setEditTempText(form.customDuration ?? "");
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
    const editStep = NATURE_TRIP_QUESTIONS.find((q) => q.key === (key === "childAgeBands" ? "companions" : key));
    if (!editStep) return;

    let newLabel = "";

    if (key === "companions" && editStep.type === "companions") {
      if (!editTempCompanion) return;
      updateField("companions", editTempCompanion as NatureTripAnswers["companions"]);
      updateField("hasPet", editTempHasPet);
      const label = labelFor(editStep.options, editTempCompanion);
      newLabel = editTempHasPet ? `${label} · 🐶 עם בעל חיים` : label;

      if (editTempCompanion !== editStep.childAgeTriggerValue) {
        updateField("childAgeBands", [] as NatureTripAnswers["childAgeBands"]);
        setMessages((msgs) => msgs.filter((m) => m.fieldKey !== "childAgeBands"));
      }
    } else if (key === "timing" && editStep.type === "date") {
      if (!editTempValue) return;
      if (editTempValue === editStep.otherDateTriggerValue) {
        if (!editTempText) return;
        updateField("timing", editTempValue as NatureTripAnswers["timing"]);
        updateField("otherDate", editTempText);
        newLabel = editTempText;
      } else {
        updateField("timing", editTempValue as NatureTripAnswers["timing"]);
        newLabel = labelFor(editStep.options, editTempValue);
      }
    } else if ((key === "distanceBand" || key === "budgetBand") && editStep.type === "slider") {
      const value = editTempSlider ?? (form[key] as string);
      updateField(key, value as never);
      newLabel = labelFor(editStep.steps as unknown as { value: string; label: string }[], value);
    } else if (key === "natureTypes" && editStep.type === "multi-emoji") {
      updateField("natureTypes", editTempMulti);
      newLabel = editTempMulti.length > 0 ? labelsFor(editStep.options, editTempMulti).join("، ") : "לא משנה לי";
    } else if (key === "childAgeBands" && editStep.type === "companions") {
      updateField("childAgeBands", editTempMulti as NatureTripAnswers["childAgeBands"]);
      newLabel = editTempMulti.length > 0 ? labelsFor(editStep.childAgeOptions, editTempMulti).join("، ") : "לא רלוונטי";
    } else if (key === "difficulty" && editStep.type === "single") {
      if (!editTempValue) return;
      updateField("difficulty", editTempValue as NatureTripAnswers["difficulty"]);
      newLabel = labelFor(editStep.options, editTempValue);
    } else if (key === "durationBand" && editStep.type === "single") {
      if (!editTempValue) return;
      updateField("durationBand", editTempValue as NatureTripAnswers["durationBand"]);
      if (editTempValue === "custom") {
        if (!editTempText) return;
        updateField("customDuration", editTempText);
        newLabel = editTempText;
      } else {
        updateField("customDuration", null);
        newLabel = labelFor(editStep.options, editTempValue);
      }
    } else if (key === "freeText") {
      updateField("freeText", editTempText);
      newLabel = editTempText || "—";
    }

    setMessages((msgs) => msgs.map((m) => (m.id === editingMessageId ? { ...m, text: newLabel } : m)));
    closeEdit();
  }

/**
   * בקשה מפורשת - אותה ארכיטקטורה בדיוק כמו טיול יומי: המלל החופשי כבר
   * לא בונה ישר - הוא מפעיל חילוץ ומציג "בואו נבנה יחד"/"אמשיך לבד".
   */
  async function confirmFreeText() {
    const finalForm = { ...form, freeText: tempText };
    setForm(finalForm);
    addUser(tempText || "—", "freeText");
    resetTempAnswerState();
    setTyping(true);
    extractedIntentRef.current = await fetchExtractedNatureTripIntent(tempText);
    setTyping(false);
    setShowBuildChoice(true);
  }

  async function fetchExtractedNatureTripIntent(freeText: string): Promise<ExtractedNatureTripIntent | null> {
    try {
      const res = await fetch("/api/trip-builder/nature-trip/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeText }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.extracted as ExtractedNatureTripIntent) ?? null;
    } catch {
      return null;
    }
  }

  function confirmBuildTogether() {
    setShowBuildChoice(false);
    addUser("בואו נבנה יחד", "freeText");
    advanceNatureTrip(2, form);
  }

  function advanceNatureTrip(fromIndex: number, current: NatureTripAnswers) {
    const extracted = extractedIntentRef.current;
    let idx = fromIndex;
    let workingForm = current;

    while (extracted && idx < NATURE_TRIP_QUESTIONS.length) {
      const s = NATURE_TRIP_QUESTIONS[idx];

      if (s.type === "companions" && extracted.companions) {
        workingForm = { ...workingForm, companions: extracted.companions, hasPet: extracted.hasPet };
        const label = labelFor(s.options, extracted.companions);
        addUser(extracted.hasPet ? `${label} · 🐶 עם בעל חיים` : label, "companions");
        if (extracted.companions === s.childAgeTriggerValue) {
          if (extracted.childAgeBands.length > 0) {
            workingForm = { ...workingForm, childAgeBands: extracted.childAgeBands as NatureTripAnswers["childAgeBands"] };
            addUser(labelsFor(s.childAgeOptions, extracted.childAgeBands).join("، "), "childAgeBands");
          } else {
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
        workingForm = { ...workingForm, distanceBand: extracted.distanceBand as NatureTripAnswers["distanceBand"] };
        addUser(labelFor(s.steps, extracted.distanceBand), "distanceBand");
        idx += 1;
        continue;
      }

      if (s.type === "slider" && s.key === "budgetBand" && extracted.budgetBand) {
        workingForm = { ...workingForm, budgetBand: extracted.budgetBand as NatureTripAnswers["budgetBand"] };
        addUser(labelFor(s.steps, extracted.budgetBand), "budgetBand");
        idx += 1;
        continue;
      }

      if (s.type === "multi-emoji" && extracted.natureTypes.length > 0) {
        workingForm = { ...workingForm, natureTypes: extracted.natureTypes as NatureTripAnswers["natureTypes"] };
        addUser(labelsFor(s.options, extracted.natureTypes).join("، "), "natureTypes");
        idx += 1;
        continue;
      }

      if (s.type === "single" && s.key === "difficulty" && extracted.difficulty) {
        workingForm = { ...workingForm, difficulty: extracted.difficulty as NatureTripAnswers["difficulty"] };
        addUser(labelFor(s.options, extracted.difficulty), "difficulty");
        idx += 1;
        continue;
      }

      // durationBand="custom" דורש שאלת המשך (טקסט חופשי לתיאור הזמן) -
      // לא מדלגים עליה אוטומטית, גם אם היא חולצה, כדי לא לדלג על שאלת
      // ההמשך ההכרחית. כל שאר הערכים כן מדלגים כרגיל.
      if (s.type === "single" && s.key === "durationBand" && extracted.durationBand && extracted.durationBand !== "custom") {
        workingForm = { ...workingForm, durationBand: extracted.durationBand as NatureTripAnswers["durationBand"] };
        addUser(labelFor(s.options, extracted.durationBand), "durationBand");
        idx += 1;
        continue;
      }

      break;
    }

    setForm(workingForm);

    if (idx >= NATURE_TRIP_QUESTIONS.length) {
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

  /** "אמשיך לבד" - בונה ישר, עם natureTypes מה-DNA (אם קיים) או ברירות המחדל הגנריות. */
  async function confirmBuildAlone() {
    setShowBuildChoice(false);
    addUser("אמשיך לבד", "freeText");
    setTyping(true);
    let finalForm = form;
    try {
      const res = await fetch("/api/trip-builder/nature-trip/dna-defaults");
      const data = await res.json();
      if (Array.isArray(data.natureTypes) && data.natureTypes.length > 0) {
        finalForm = { ...finalForm, natureTypes: data.natureTypes };
      }
    } catch {
      // נכשל - ממשיכים עם ברירות המחדל הגנריות הרגילות, לא חוסם
    }
    setForm(finalForm);
    setTyping(false);
    createSessionAndWaitThenNavigate(finalForm);
  }

  // ---------- שליחה סופית ----------

  /**
   * בקשה מפורשת - לא קופצים למסך המשחק אוטומטית: נשארים כאן בצ'אט,
   * בונים ברקע, ומתשאלים עד שהמסלול מוכן (או עד תקרה בטיחותית של 20
   * שניות) - ואז עוברים ישר לעמוד המוכן.
   */
  async function createSessionAndWaitThenNavigate(answers: NatureTripAnswers) {
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
        body: JSON.stringify({ tripType: "nature_trip", answers, origin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "יצירת הטיול נכשלה");

      const sessionId = data.session.id;
      setPendingSessionId(sessionId);
      fetch(`/api/trip-builder/sessions/${sessionId}/auto-build`, { method: "POST" }).catch(() => {});

      const MAX_WAIT_MS = 20000;
      const POLL_INTERVAL_MS = 1200;
      const startedAt = Date.now();
      while (Date.now() - startedAt < MAX_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        try {
          const pollRes = await fetch(`/api/trip-builder/sessions?sessionId=${sessionId}`);
          const pollData = await pollRes.json();
          const s = pollData?.session;
          const hasStops = (s?.final_itinerary?.stops?.length ?? 0) > 0;
          if (s?.status === "completed" || hasStops) break;
        } catch {
          // שגיאת רשת חד-פעמית בתשאול - ממשיכים לנסות
        }
      }
      router.push(`/trip-builder/nature-trip/result?sessionId=${sessionId}`);
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
      return { label: "המשך", onClick: confirmNatureTypes };
    }
    if (step.type === "single" && awaitingCustomDuration) {
      return { label: "המשך", onClick: confirmCustomDuration, disabled: !tempText };
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

  return (
    <Screen withBottomNavSpacing>
      <div className="-mx-5 -mt-8">
        <TripBuilderHeader current={stepIndex + 1} total={NATURE_TRIP_QUESTIONS.length} onBack={() => router.push("/home")} />
      </div>

      <div className="mx-auto flex max-w-md flex-col gap-4 px-1 pt-4 pb-6">
        {messages.map((m) => {
          if (editingFieldKey && m.id === editingMessageId) {
            return (
              <div key={m.id} className="mt-1">
                {editingFieldKey === "companions" &&
                  (() => {
                    const editStep = NATURE_TRIP_QUESTIONS.find((q) => q.key === "companions");
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
                    const companionsStep = NATURE_TRIP_QUESTIONS.find((q) => q.key === "companions");
                    if (!companionsStep || companionsStep.type !== "companions") return null;
                    return (
                      <ChipGroup options={companionsStep.childAgeOptions} selected={editTempMulti} onChange={setEditTempMulti} />
                    );
                  })()}

                {editingFieldKey === "timing" &&
                  (() => {
                    const editStep = NATURE_TRIP_QUESTIONS.find((q) => q.key === "timing");
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
                    const editStep = NATURE_TRIP_QUESTIONS.find((q) => q.key === editingFieldKey);
                    if (!editStep || editStep.type !== "slider") return null;
                    return (
                      <Slider
                        steps={editStep.steps}
                        value={editTempSlider ?? (form[editingFieldKey] as string)}
                        onChange={setEditTempSlider}
                      />
                    );
                  })()}

                {editingFieldKey === "natureTypes" &&
                  (() => {
                    const editStep = NATURE_TRIP_QUESTIONS.find((q) => q.key === "natureTypes");
                    if (!editStep || editStep.type !== "multi-emoji") return null;
                    return <ChipGroup options={editStep.options} selected={editTempMulti} onChange={setEditTempMulti} />;
                  })()}

                {editingFieldKey === "difficulty" &&
                  (() => {
                    const editStep = NATURE_TRIP_QUESTIONS.find((q) => q.key === "difficulty");
                    if (!editStep || editStep.type !== "single") return null;
                    return <AnswerOptions options={editStep.options} selected={editTempValue} onSelect={setEditTempValue} />;
                  })()}

                {editingFieldKey === "durationBand" &&
                  (() => {
                    const editStep = NATURE_TRIP_QUESTIONS.find((q) => q.key === "durationBand");
                    if (!editStep || editStep.type !== "single") return null;
                    return (
                      <div className="flex flex-col gap-3">
                        <AnswerOptions options={editStep.options} selected={editTempValue} onSelect={setEditTempValue} />
                        {editTempValue === "custom" && (
                          <input
                            type="text"
                            value={editTempText}
                            onChange={(e) => setEditTempText(e.target.value)}
                            placeholder="לדוגמה: 3 שעות בערך"
                            className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
                          />
                        )}
                      </div>
                    );
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
                  value={tempSlider ?? (form[step.key as keyof NatureTripAnswers] as string)}
                  onChange={(value) => setTempSlider(value)}
                />
              </div>
            )}

            {step.type === "multi-emoji" && (
              <ChipGroup options={step.options} selected={tempMulti} onChange={setTempMulti} />
            )}

            {step.type === "single" && !awaitingCustomDuration && (
              <AnswerOptions options={step.options} onSelect={handleSingleSelect} />
            )}
            {step.type === "single" && awaitingCustomDuration && (
              <input
                type="text"
                value={tempText}
                onChange={(e) => setTempText(e.target.value)}
                placeholder="לדוגמה: 3 שעות בערך"
                className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
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

        {/* בקשה מפורשת - בדיוק כמו טיול יומי/חופשה בחו"ל: אחרי המלל
            החופשי, שתי אפשרויות - להמשיך לענות על מה שלא כוסה, או לבנות ישר. */}
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
            <ChatBubble>רגע, בונים לכם את יום הטבע...</ChatBubble>
            {pendingSessionId && (
              <RuntrippyPromptBubble
                onClick={() => {
                  router.push(`/trip-builder/nature-trip/result?sessionId=${pendingSessionId}`);
                }}
              />
            )}
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
