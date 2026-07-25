"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Screen, ChipGroup, Field, Slider } from "@/components/ui";
import { ROMANTIC_DATE_QUESTIONS } from "@/services/tripBuilder/rules/romanticDate";
import type { RomanticDateAnswers } from "@/services/tripBuilder/types";
import { ChatHeader } from "@/screens/trip-builder/chat/ChatHeader";
import { ChatBubble } from "@/screens/trip-builder/chat/ChatBubble";
import { UserBubble } from "@/screens/trip-builder/chat/UserBubble";
import { TypingIndicator } from "@/screens/trip-builder/chat/TypingIndicator";
import { AnswerOptions } from "@/screens/trip-builder/chat/AnswerOptions";
import { MainBottomNav } from "@/components/MainBottomNav";
import { useAuth } from "@/hooks/useAuth";

type TripChoice = "triplace" | "tripmatch";

const DEFAULT_ANSWERS: RomanticDateAnswers = {
  dateWith: "partner",
  timing: "today",
  otherDate: null,
  distanceBand: "1h",
  budgetBand: "300-600",
  dateType: [],
  freeText: "",
};

type EditableFieldKey = "dateWith" | "timing" | "distanceBand" | "budgetBand" | "dateType" | "freeText";

type ChatMessage = {
  id: number;
  role: "assistant" | "user" | "icon";
  text: string;
  fieldKey?: EditableFieldKey;
};

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

function TripChoiceCards({ onChoose, disabled }: { onChoose: (choice: TripChoice) => void; disabled: boolean }) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onChoose("triplace")}
        disabled={disabled}
        className="flex-1 rounded-card bg-white p-4 shadow-soft transition active:scale-95 disabled:opacity-50"
      >
        <div className="relative mx-auto h-8 w-full">
          <Image src="/images/trip-triplace-logo.png" alt="TripPlace" fill className="object-contain" />
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-secondary">ה-AI בונה הכל אוטומטית</p>
      </button>

      <button
        type="button"
        onClick={() => onChoose("tripmatch")}
        disabled={disabled}
        className="flex-1 rounded-card bg-white p-4 shadow-soft transition active:scale-95 disabled:opacity-50"
      >
        <div className="relative mx-auto h-8 w-full">
          <Image src="/images/trip-tripmatch-logo.png" alt="TripMatch" fill className="object-contain" />
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-secondary">בוחרים לבד עם החלקות</p>
      </button>
    </div>
  );
}

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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-base">💑</div>
        <span className="text-[13.5px] font-medium text-white">{label}</span>
      </div>
    </div>
  );
}

export default function RomanticDateQuestionnairePage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<RomanticDateAnswers>(DEFAULT_ANSWERS);
  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [awaitingTripChoice, setAwaitingTripChoice] = useState(false);
  const [busyChoice, setBusyChoice] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [awaitingOtherDate, setAwaitingOtherDate] = useState(false);
  const [tempMulti, setTempMulti] = useState<string[]>([]);
  const [tempSlider, setTempSlider] = useState<string | null>(null);
  const [tempText, setTempText] = useState("");
  const [tempSingle, setTempSingle] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const startedRef = useRef(false);

  const step = ROMANTIC_DATE_QUESTIONS[stepIndex];
  const isLastStep = stepIndex === ROMANTIC_DATE_QUESTIONS.length - 1;

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

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    addBot("שלום! אני טריפי AI 👋\nבואו נתכנן ביחד דייט רומנטי מושלם, בדיוק בשבילכם.");
    addIconBadge("דייט רומנטי");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      addBot(ROMANTIC_DATE_QUESTIONS[0].title);
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  function updateField<K extends keyof RomanticDateAnswers>(key: K, value: RomanticDateAnswers[K]) {
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
    setTempSingle(null);
    setAwaitingOtherDate(false);
  }

  function goToNextStep() {
    resetTempAnswerState();
    if (isLastStep) {
      promptTripChoice();
      return;
    }
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setStepIndex((i) => i + 1);
    }, 550);
  }

  useEffect(() => {
    if (stepIndex === 0) return;
    addBot(ROMANTIC_DATE_QUESTIONS[stepIndex].title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  function confirmSingle() {
    if (step.type !== "single" || !tempSingle) return;
    updateField("dateWith", tempSingle as RomanticDateAnswers["dateWith"]);
    addUser(labelFor(step.options, tempSingle), "dateWith");
    goToNextStep();
  }

  function handleDateSelect(value: string) {
    if (step.type !== "date") return;
    updateField("timing", value as RomanticDateAnswers["timing"]);
    addUser(labelFor(step.options, value), "timing");
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
    const value = tempSlider ?? (form[step.key as keyof RomanticDateAnswers] as string) ?? step.steps[0].value;
    updateField(step.key as keyof RomanticDateAnswers, value as never);
    addUser(labelFor(step.steps as unknown as { value: string; label: string }[], value), step.key as EditableFieldKey);
    goToNextStep();
  }

  function confirmDateType() {
    if (step.type !== "multi-emoji") return;
    updateField("dateType", tempMulti);
    addUser(tempMulti.length > 0 ? labelsFor(step.options, tempMulti).join("، ") : "תפתיעו אותנו", "dateType");
    goToNextStep();
  }

  function confirmFreeText() {
    updateField("freeText", tempText);
    addUser(tempText || "—", "freeText");
    goToNextStep();
  }

  function promptTripChoice() {
    if (!user) {
      router.push("/auth");
      return;
    }
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      addBot("מעולה! עכשיו תבחרו איך תרצו למצוא את המקום:");
      setAwaitingTripChoice(true);
    }, 700);
  }

  async function handleTripChoice(choice: TripChoice) {
    if (busyChoice) return;
    setBusyChoice(true);
    setLocationError(null);

    try {
      const origin = await getCurrentPosition();
      const response = await fetch("/api/trip-builder/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripType: "romantic_date", answers: form, origin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "יצירת החיפוש נכשלה");

      const sessionId = data.session.id;

      if (choice === "tripmatch") {
        router.push(`/trip-builder/romantic-date/build?sessionId=${sessionId}`);
        return;
      }

      setSubmitting(true);
      const buildResponse = await fetch(`/api/trip-builder/sessions/${sessionId}/auto-build`, { method: "POST" });
      const buildData = await buildResponse.json();
      if (!buildResponse.ok) throw new Error(buildData.error ?? "החיפוש נכשל");
      router.push(`/trip-builder/romantic-date/result?sessionId=${sessionId}`);
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : "לא הצלחנו למצוא מקום. יש לאשר גישה למיקום ולנסות שוב."
      );
      setBusyChoice(false);
      setSubmitting(false);
    }
  }

  function getFooterAction(): { label: string; onClick: () => void; disabled?: boolean } | null {
    if (typing || submitting) return null;
    if (step.type === "single") return { label: "המשך", onClick: confirmSingle, disabled: !tempSingle };
    if (step.type === "date" && awaitingOtherDate) return { label: "המשך", onClick: confirmOtherDate, disabled: !tempText };
    if (step.type === "slider") return { label: "בחרתי", onClick: confirmSlider };
    if (step.type === "multi-emoji") return { label: "המשך", onClick: confirmDateType };
    if (step.type === "text") return { label: "המשך", onClick: confirmFreeText };
    return null;
  }

  const footerAction = getFooterAction();

  return (
    <Screen withBottomNavSpacing>
      <div className="-mx-5 -mt-8">
        <ChatHeader current={stepIndex + 1} total={ROMANTIC_DATE_QUESTIONS.length} onBack={() => router.push("/home")} />
      </div>

      <div className="mx-auto flex max-w-md flex-col gap-4 px-1 pt-4 pb-64">
        {messages.map((m) =>
          m.role === "assistant" ? (
            <ChatBubble key={m.id}>{m.text}</ChatBubble>
          ) : m.role === "icon" ? (
            <div key={m.id} className="flex items-end justify-end gap-2">
              <TripTypeBadge label={m.text} />
              <UserAvatar avatarUrl={profile?.avatar_url ?? null} name={profile?.full_name ?? null} />
            </div>
          ) : (
            <div key={m.id} className="flex items-end justify-end gap-2">
              <UserBubble>{m.text}</UserBubble>
              <UserAvatar avatarUrl={profile?.avatar_url ?? null} name={profile?.full_name ?? null} />
            </div>
          )
        )}

        {typing && <TypingIndicator />}

        {!typing && !submitting && !awaitingTripChoice && (
          <div className="mt-1">
            {step.type === "single" && (
              <AnswerOptions options={step.options} selected={tempSingle} onSelect={setTempSingle} />
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
                  value={tempSlider ?? (form[step.key as keyof RomanticDateAnswers] as string)}
                  onChange={(value) => setTempSlider(value)}
                />
              </div>
            )}

            {step.type === "multi-emoji" && (
              <ChipGroup options={step.options} selected={tempMulti} onChange={setTempMulti} />
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

        {awaitingTripChoice && (
          <>
            <TripChoiceCards onChoose={handleTripChoice} disabled={busyChoice} />
            {submitting && <ChatBubble>רגע, בונים לכם את הדייט...</ChatBubble>}
          </>
        )}

        {locationError && <p className="text-center text-sm text-danger">{locationError}</p>}

        {!awaitingTripChoice && footerAction && (
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
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("הדפדפן שלך לא תומך באיתור מיקום"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error("יש לאשר גישה למיקום כדי למצוא מקום קרוב אליכם")),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
}