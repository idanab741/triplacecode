"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ChipGroup, Field, Screen, Slider } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { DAY_TRIP_QUESTIONS } from "@/services/tripBuilder/rules/dayTrip";
import type { DayTripAnswers } from "@/services/tripBuilder/types";
import { ChatHeader } from "@/screens/trip-builder/chat/ChatHeader";
import { ChatBubble } from "@/screens/trip-builder/chat/ChatBubble";
import { UserBubble } from "@/screens/trip-builder/chat/UserBubble";
import { TypingIndicator } from "@/screens/trip-builder/chat/TypingIndicator";
import { AnswerOptions } from "@/screens/trip-builder/chat/AnswerOptions";

const DEFAULT_ANSWERS: DayTripAnswers = {
  companions: "solo",
  childAgeBands: [],
  timing: "today",
  otherDate: null,
  distanceBand: "1h",
  budgetBand: "300-600",
  interests: [],
  durationBand: "2-4h",
  freeText: "",
};

type ChatMessage = { id: number; role: "assistant" | "user"; text: string };

export default function DayTripQuestionnairePage() {
  const router = useRouter();
  const { user } = useAuth();

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

  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const startedRef = useRef(false);

  const step = DAY_TRIP_QUESTIONS[stepIndex];
  const isLastStep = stepIndex === DAY_TRIP_QUESTIONS.length - 1;

  function nextId() {
    idRef.current += 1;
    return idRef.current;
  }
  function addBot(text: string) {
    setMessages((m) => [...m, { id: nextId(), role: "assistant", text }]);
  }
  function addUser(text: string) {
    setMessages((m) => [...m, { id: nextId(), role: "user", text }]);
  }

 // מציג את הודעת הפתיחה ואז את השאלה הראשונה, פעם אחת כשהעמוד נטען
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    addBot(
      "שלום! אני טריפי AI 👋\nסוכן ה-AI האישי של TRIPLACE.\nאני כאן כדי להכיר אתכם, להבין בדיוק מה אתם מחפשים, ולבנות עבורכם חופשה שתוכננה במיוחד בשבילכם — מהיעדים ועד המסלול המושלם.\nאז בואו נתחיל!"
    );
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
    setAwaitingChildAges(false);
    setAwaitingOtherDate(false);
  }

  function goToNextStep() {
    resetTempAnswerState();
    if (isLastStep) {
      submit();
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
    if (step.type !== "companions") return;
    updateField("companions", value as DayTripAnswers["companions"]);
    const label = labelFor(step.options, value);
    addUser(label);

    if (value === step.childAgeTriggerValue) {
      setAwaitingChildAges(true);
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        addBot(step.childAgeTitle);
      }, 500);
      return;
    }
    goToNextStep();
  }

  function confirmChildAges() {
    if (step.type !== "companions") return;
    updateField("childAgeBands", tempMulti as DayTripAnswers["childAgeBands"]);
    addUser(tempMulti.length > 0 ? labelsFor(step.childAgeOptions, tempMulti).join("، ") : "לא רלוונטי");
    goToNextStep();
  }

  function handleDateSelect(value: string) {
    if (step.type !== "date") return;
    updateField("timing", value as DayTripAnswers["timing"]);
    const label = labelFor(step.options, value);
    addUser(label);

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
    addUser(value);
    goToNextStep();
  }

  function confirmInterests() {
    if (step.type !== "multi-emoji") return;
    updateField("interests", tempMulti);
    addUser(tempMulti.length > 0 ? labelsFor(step.options, tempMulti).join("، ") : "לא משנה לי");
    goToNextStep();
  }

  function handleSingleSelect(value: string) {
    if (step.type !== "single") return;
    updateField(step.key as keyof DayTripAnswers, value as never);
    const label = labelFor(step.options, value);
    addUser(label);
    goToNextStep();
  }

  function confirmFreeText() {
    updateField("freeText", tempText);
    addUser(tempText || "—");
    goToNextStep();
  }

  // ---------- שליחה סופית ----------

  async function submit() {
    if (!user) {
      router.push("/auth");
      return;
    }
    setSubmitting(true);
    setLocationError(null);
    try {
      const origin = await getCurrentPosition();
      const response = await fetch("/api/trip-builder/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripType: "day_trip", answers: form, origin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "יצירת הטיול נכשלה");
      router.push(`/trip-builder/day-trip/build?sessionId=${data.session.id}`);
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : "לא הצלחנו לקבל את המיקום שלך. יש לאשר גישה למיקום כדי להמשיך."
      );
      setSubmitting(false);
    }
  }

  // קובע איזה כפתור "המשך" קבוע יופיע למטה, לפי מצב השאלה הנוכחית —
  // undefined כשלא צריך כפתור (למשל כשהתשובה היא בחירת צ'יפ בודדת)
  function getFooterAction(): { label: string; onClick: () => void; disabled?: boolean } | null {
    if (typing || submitting) return null;
    if (step.type === "companions" && awaitingChildAges) {
      return { label: "המשך", onClick: confirmChildAges };
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

  return (
<Screen withBottomNavSpacing={false}>
      <div className="-mx-5 -mt-8">
        <ChatHeader current={stepIndex + 1} total={DAY_TRIP_QUESTIONS.length} />
      </div>
      <div className={`mx-auto flex max-w-md flex-col gap-4 px-4 pt-4 ${footerAction ? "pb-28" : "pb-10"}`}>
        {messages.map((m) =>
          m.role === "assistant" ? (
            <ChatBubble key={m.id}>{m.text}</ChatBubble>
          ) : (
            <UserBubble key={m.id}>{m.text}</UserBubble>
          )
        )}

        {typing && <TypingIndicator />}

        {!typing && !submitting && (
          <div className="mt-1">
            {step.type === "companions" && !awaitingChildAges && (
              <AnswerOptions options={step.options} onSelect={handleCompanionsSelect} />
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

            {step.type === "text" && (
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

        {submitting && <ChatBubble>מחשב את המסלול הטוב ביותר עבורכם</ChatBubble>}
        {locationError && <p className="text-center text-sm text-danger">{locationError}</p>}

        <div ref={bottomRef} />
      </div>

      {/* כפתור "המשך" קבוע בתחתית המסך, לאורך כל השאלות שדורשות אישור */}
      {footerAction && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-secondary/10 bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(16,24,40,0.06)]">
          <div className="mx-auto max-w-md">
            <Button variant="primary" fullWidth onClick={footerAction.onClick} disabled={footerAction.disabled}>
              {footerAction.label}
            </Button>
          </div>
        </div>
      )}
    </Screen>
  );
}

function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("הדפדפן שלך לא תומך באיתור מיקום"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error("יש לאשר גישה למיקום כדי לבנות טיול קרוב אליכם")),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
}
