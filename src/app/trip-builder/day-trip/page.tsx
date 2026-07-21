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
import Image from "next/image";

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

  const step = DAY_TRIP_QUESTIONS[stepIndex];
  const isLastStep = stepIndex === DAY_TRIP_QUESTIONS.length - 1;

  function nextId() {
    idRef.current += 1;
    return idRef.current;
  }
  function addBot(text: string) {
    setMessages((m) => [...m, { id: nextId(), role: "assistant", text }]);
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

  function openEdit(message: ChatMessage) {
    if (!message.fieldKey || typing || submitting || editingFieldKey) return;
    const key = message.fieldKey;
    setEditingFieldKey(key);
    setEditingMessageId(message.id);

    if (key === "companions") {
      setEditTempCompanion(form.companions);
      setEditTempHasPet(form.hasPet);
    } else if (key === "interests") {
      setEditTempMulti(form.interests);
    } else if (key === "distanceBand" || key === "budgetBand") {
      setEditTempSlider(form[key] as string);
    } else if (key === "freeText") {
      setEditTempText(form.freeText);
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
    const editStep = DAY_TRIP_QUESTIONS.find((q) => q.key === key);
    if (!editStep) return;

    let newLabel = "";

    if (key === "companions" && editStep.type === "companions") {
      if (!editTempCompanion) return;
      updateField("companions", editTempCompanion as DayTripAnswers["companions"]);
      updateField("hasPet", editTempHasPet);
      const label = labelFor(editStep.options, editTempCompanion);
      newLabel = editTempHasPet ? `${label} · 🐶 עם בעל חיים` : label;
    } else if (key === "timing" && editStep.type === "date") {
      if (!editTempValue) return;
      updateField("timing", editTempValue as DayTripAnswers["timing"]);
      newLabel = labelFor(editStep.options, editTempValue);
    } else if ((key === "distanceBand" || key === "budgetBand") && editStep.type === "slider") {
      const value = editTempSlider ?? (form[key] as string);
      updateField(key, value as never);
      newLabel = labelFor(editStep.steps as unknown as { value: string; label: string }[], value);
    } else if (key === "interests" && editStep.type === "multi-emoji") {
      updateField("interests", editTempMulti);
      newLabel = editTempMulti.length > 0 ? labelsFor(editStep.options, editTempMulti).join("، ") : "לא משנה לי";
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

function confirmFreeText() {
    updateField("freeText", tempText);
    addUser(tempText || "—", "freeText");
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

  function getFooterAction(): { label: string; onClick: () => void; disabled?: boolean } | null {
    if (typing || submitting) return null;
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

  return (
    <Screen withBottomNavSpacing={false}>
      <div className="-mx-5 -mt-8">
        <ChatHeader current={stepIndex + 1} total={DAY_TRIP_QUESTIONS.length} onBack={() => router.back()} />
      </div>

      <div className={`mx-auto flex max-w-md flex-col gap-4 px-4 pt-4 ${footerAction ? "pb-28" : "pb-10"}`}>
{messages.map((m) =>
          m.role === "assistant" ? (
            <ChatBubble key={m.id}>{m.text}</ChatBubble>
          ) : m.role === "icon" ? (
            <TripTypeBadge key={m.id} label={m.text} />
          ) : (
            <UserBubble key={m.id} onClick={m.fieldKey ? () => openEdit(m) : undefined}>
              {m.text}
            </UserBubble>
          )
        )}

        {typing && <TypingIndicator />}

        {!typing && !submitting && (
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

{footerAction && (
        <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
          <Button variant="primary" onClick={footerAction.onClick} disabled={footerAction.disabled}>
            {footerAction.label}
          </Button>
        </div>
      )}

      {editingFieldKey && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 px-4 pb-6"
          onClick={closeEdit}
        >
          <div
            className="w-full max-w-md rounded-card bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-semibold text-ink">
              {DAY_TRIP_QUESTIONS.find((q) => q.key === editingFieldKey)?.title}
            </p>

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

            {editingFieldKey === "timing" &&
              (() => {
                const editStep = DAY_TRIP_QUESTIONS.find((q) => q.key === "timing");
                if (!editStep || editStep.type !== "date") return null;
                return <AnswerOptions options={editStep.options} selected={editTempValue} onSelect={setEditTempValue} />;
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

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="flex-1 rounded-pill border border-ink-secondary/25 py-2.5 text-sm font-medium text-ink-secondary"
              >
                ביטול
              </button>
              <Button variant="primary" fullWidth onClick={confirmEdit}>
                עדכן
              </Button>
            </div>
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