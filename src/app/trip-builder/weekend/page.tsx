"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Screen, ChipGroup, Field, Slider } from "@/components/ui";
import { DateRangePicker } from "@/screens/trip-builder/chat/DateRangePicker";
import { HotelAutocomplete } from "@/screens/trip-builder/chat/HotelAutocomplete";
import { LoadingGame } from "@/screens/trip-builder/LoadingGame";
import {
  VACATION_COMPANION_OPTIONS,
  VACATION_CHILD_AGE_OPTIONS,
  LODGING_TYPE_OPTIONS,
  VACATION_PACE_OPTIONS,
} from "@/locales/he/abroadVacation";
import { WEEKEND_STYLE_OPTIONS, WEEKEND_BUDGET_STEPS } from "@/locales/he/weekend";
import { DISTANCE_STEPS } from "@/locales/he/tripBuilder";
import type { WeekendAnswers } from "@/services/tripBuilder/types";
import { TripBuilderHeader } from "@/screens/trip-builder/chat/TripBuilderHeader";
import { ChatBubble } from "@/screens/trip-builder/chat/ChatBubble";
import { UserBubble } from "@/screens/trip-builder/chat/UserBubble";
import { TypingIndicator } from "@/screens/trip-builder/chat/TypingIndicator";
import { AnswerOptions } from "@/screens/trip-builder/chat/AnswerOptions";
import { MainBottomNav } from "@/components/MainBottomNav";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";

type Stage =
  | "companions"
  | "childAges"
  | "dates"
  | "distanceBand"
  | "bookedQuestion"
  | "lodgingInfo"
  | "lodgingType"
  | "weekendStyles"
  | "pace"
  | "budget"
  | "freeText";

const STAGE_TITLES: Record<Stage, string> = {
  companions: "עם מי אתם נוסעים?",
  childAges: "גילאי הילדים",
  dates: "מתי נוסעים? תאריך התחלה",
  distanceBand: "מרחק מקסימלי מהבית",
  bookedQuestion: "האם כבר סגרתם מקום לינה?",
  lodgingInfo: "איפה מקום הלינה?",
  lodgingType: "איזה סוג לינה אתם מחפשים?",
  weekendStyles: 'איזה סגנון סופ"ש אתם מחפשים?',
  pace: "מה קצב הטיול שלכם?",
  budget: "מה התקציב?",
  freeText: "משהו נוסף שתרצו להוסיף?",
};

const DEFAULT_ANSWERS: WeekendAnswers = {
  companions: "couple",
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

type ChatMessage = { id: number; role: "assistant" | "user" | "icon"; text: string; editStage?: Stage };

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

  const [stage, setStage] = useState<Stage>("companions");
  const [form, setForm] = useState<WeekendAnswers>(DEFAULT_ANSWERS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // temp state per stage
  const [tempCompanion, setTempCompanion] = useState<string | null>(null);
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
  const [tempFreeText, setTempFreeText] = useState("");

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

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    addBot('שלום! אני טריפי AI 👋\nבואו נתכנן ביחד את הסופ"ש הבא שלכם.');
    addIconBadge('סופ"ש');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      addBot(STAGE_TITLES.companions);
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

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

  function confirmCompanions() {
    if (!tempCompanion) return;
    setForm((f) => ({ ...f, companions: tempCompanion as WeekendAnswers["companions"] }));
    addUser(labelFor(VACATION_COMPANION_OPTIONS, tempCompanion), "companions");
    if (tempCompanion === "family") {
      goTo("childAges");
    } else {
      goTo("dates");
    }
  }

  function confirmChildAges() {
    setForm((f) => ({ ...f, childAgeBands: tempChildAges as WeekendAnswers["childAgeBands"] }));
    addUser(tempChildAges.length > 0 ? labelsFor(VACATION_CHILD_AGE_OPTIONS, tempChildAges).join("، ") : "לא רלוונטי", "childAges");
    goTo("dates");
  }

  function confirmDates() {
    if (!tempStartDate || !tempEndDate) return;
    setForm((f) => ({ ...f, startDate: tempStartDate, endDate: tempEndDate }));
    addUser(`${tempStartDate} עד ${tempEndDate}`, "dates");
    goTo("distanceBand");
  }

  function confirmDistance() {
    const value = tempDistance ?? DISTANCE_STEPS[0].value;
    setForm((f) => ({ ...f, distanceBand: value as WeekendAnswers["distanceBand"] }));
    addUser(labelFor(DISTANCE_STEPS, value), "distanceBand");
    goTo("bookedQuestion");
  }

  function confirmBooked() {
    if (!tempBooked) return;
    const booked = tempBooked === "yes";
    setForm((f) => ({ ...f, hasBookedLodging: booked }));
    addUser(booked ? "כן" : "לא", "bookedQuestion");
    if (booked) {
      goTo("lodgingInfo");
    } else {
      goTo("lodgingType");
    }
  }

  function confirmLodgingInfo() {
    if (!tempLodgingName && !tempLodgingAddress) return;
    setForm((f) => ({ ...f, lodgingName: tempLodgingName || null, lodgingAddress: tempLodgingAddress || null }));
    addUser(tempLodgingName || tempLodgingAddress, "lodgingInfo");
    goTo("weekendStyles");
  }

  function confirmLodgingType() {
    if (!tempLodgingType) return;
    setForm((f) => ({ ...f, lodgingType: tempLodgingType as WeekendAnswers["lodgingType"] }));
    addUser(labelFor(LODGING_TYPE_OPTIONS, tempLodgingType), "lodgingType");
    goTo("weekendStyles");
  }

  function confirmStyles() {
    setForm((f) => ({ ...f, weekendStyles: tempStyles }));
    addUser(tempStyles.length > 0 ? labelsFor(WEEKEND_STYLE_OPTIONS, tempStyles).join("، ") : "תפתיעו אותנו", "weekendStyles");
    goTo("pace");
  }

  function confirmPace() {
    if (!tempPace) return;
    setForm((f) => ({ ...f, pace: tempPace as WeekendAnswers["pace"] }));
    addUser(labelFor(VACATION_PACE_OPTIONS, tempPace), "pace");
    goTo("budget");
  }

  function confirmBudget() {
    if (!tempBudget) return;
    setForm((f) => ({ ...f, budgetPerPerson: tempBudget }));
    addUser(labelFor(WEEKEND_BUDGET_STEPS, tempBudget), "budget");
    goTo("freeText");
  }

  function confirmFreeText() {
    const finalForm = { ...form, freeText: tempFreeText };
    setForm(finalForm);
    addUser(tempFreeText || "—", "freeText");
    buildTripDirectly(finalForm);
  }

  function openEdit(message: ChatMessage) {
    if (!message.editStage || typing || submitting || editingMessageId != null) return;
    setEditingMessageId(message.id);
    setEditingStage(message.editStage);

    if (message.editStage === "companions") setEditTempValue(form.companions);
    else if (message.editStage === "childAges") setEditTempMultiValue(form.childAgeBands);
    else if (message.editStage === "dates") {
      setEditTempStartDate(form.startDate);
      setEditTempEndDate(form.endDate);
    } else if (message.editStage === "distanceBand") setEditTempValue(form.distanceBand);
    else if (message.editStage === "bookedQuestion") setEditTempValue(form.hasBookedLodging ? "yes" : "no");
    else if (message.editStage === "lodgingInfo") {
      setEditTempLodgingName(form.lodgingName ?? "");
      setEditTempLodgingAddress(form.lodgingAddress ?? "");
    } else if (message.editStage === "lodgingType") setEditTempValue(form.lodgingType ?? "");
    else if (message.editStage === "weekendStyles") setEditTempMultiValue(form.weekendStyles);
    else if (message.editStage === "pace") setEditTempValue(form.pace);
    else if (message.editStage === "budget") setEditTempValue(form.budgetPerPerson);
    else if (message.editStage === "freeText") setEditTempFreeText(form.freeText);
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
      if (!editTempValue) return;
      setForm((f) => ({ ...f, companions: editTempValue as WeekendAnswers["companions"] }));
      updateMessageLabel(labelFor(VACATION_COMPANION_OPTIONS, editTempValue));
    } else if (editingStage === "childAges") {
      setForm((f) => ({ ...f, childAgeBands: editTempMultiValue as WeekendAnswers["childAgeBands"] }));
      updateMessageLabel(editTempMultiValue.length > 0 ? labelsFor(VACATION_CHILD_AGE_OPTIONS, editTempMultiValue).join("، ") : "לא רלוונטי");
    } else if (editingStage === "dates") {
      if (!editTempStartDate || !editTempEndDate) return;
      setForm((f) => ({ ...f, startDate: editTempStartDate, endDate: editTempEndDate }));
      updateMessageLabel(`${editTempStartDate} עד ${editTempEndDate}`);
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
      setForm((f) => ({ ...f, lodgingName: editTempLodgingName || null, lodgingAddress: editTempLodgingAddress || null }));
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
    } else if (editingStage === "freeText") {
      setForm((f) => ({ ...f, freeText: editTempFreeText }));
      updateMessageLabel(editTempFreeText || "—");
    } else {
      return;
    }

    closeEdit();
  }

  /** אחרי "משהו נוסף שתרצו להוסיף" עוברים ישירות לבניית הסופ"ש דרך triplace. */
  async function buildTripDirectly(answers: WeekendAnswers) {
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
        body: JSON.stringify({ tripType: "weekend", answers, origin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'יצירת הסופ"ש נכשלה');

      const sessionId = data.session.id;
      fetch(`/api/trip-builder/sessions/${sessionId}/auto-build`, { method: "POST" }).catch(() => {});
      router.push(`/trip-builder/weekend/result?sessionId=${sessionId}`);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'לא הצלחנו לבנות את הסופ"ש. נסו שוב.');
      setSubmitting(false);
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
                <AnswerOptions options={VACATION_COMPANION_OPTIONS} selected={editTempValue} onSelect={setEditTempValue} />
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
              {editingStage === "freeText" && (
                <textarea
                  value={editTempFreeText}
                  onChange={(e) => setEditTempFreeText(e.target.value)}
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
          ) : (
            <div key={m.id} className="flex items-end justify-end gap-2">
              <UserBubble onClick={m.editStage ? () => openEdit(m) : undefined}>{m.text}</UserBubble>
              <UserAvatar avatarUrl={profile?.avatar_url ?? null} name={profile?.full_name ?? null} />
            </div>
          )
        )}

        {typing && <TypingIndicator />}

        {!typing && !submitting && (
          <div className="mt-1">
            {stage === "companions" && (
              <AnswerOptions options={VACATION_COMPANION_OPTIONS} selected={tempCompanion} onSelect={setTempCompanion} />
            )}

            {stage === "childAges" && (
              <ChipGroup options={VACATION_CHILD_AGE_OPTIONS} selected={tempChildAges} onChange={setTempChildAges} />
            )}

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

            {stage === "weekendStyles" && (
              <ChipGroup options={WEEKEND_STYLE_OPTIONS} selected={tempStyles} onChange={setTempStyles} />
            )}

            {stage === "pace" && (
              <AnswerOptions options={VACATION_PACE_OPTIONS} selected={tempPace} onSelect={setTempPace} />
            )}

            {stage === "budget" && (
              <div className="rounded-card bg-white p-4 shadow-md">
                <Slider steps={WEEKEND_BUDGET_STEPS} value={tempBudget ?? WEEKEND_BUDGET_STEPS[0].value} onChange={setTempBudget} />
              </div>
            )}

            {stage === "freeText" && (
              <textarea
                value={tempFreeText}
                onChange={(e) => setTempFreeText(e.target.value)}
                placeholder="לדוגמה: רוצים הרבה טבע, מחפשים יקבים, חשוב לנו ספא..."
                rows={3}
                className="w-full rounded-card border border-ink-secondary/25 bg-bg p-4 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
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

        {!submitting && !typing && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => {
                if (stage === "companions") confirmCompanions();
                else if (stage === "childAges") confirmChildAges();
                else if (stage === "dates") confirmDates();
                else if (stage === "distanceBand") confirmDistance();
                else if (stage === "bookedQuestion") confirmBooked();
                else if (stage === "lodgingInfo") confirmLodgingInfo();
                else if (stage === "lodgingType") confirmLodgingType();
                else if (stage === "weekendStyles") confirmStyles();
                else if (stage === "pace") confirmPace();
                else if (stage === "budget") confirmBudget();
                else if (stage === "freeText") confirmFreeText();
              }}
              disabled={
                (stage === "companions" && !tempCompanion) ||
                (stage === "dates" && (!tempStartDate || !tempEndDate)) ||
                (stage === "bookedQuestion" && !tempBooked) ||
                (stage === "lodgingInfo" && !tempLodgingName && !tempLodgingAddress) ||
                (stage === "lodgingType" && !tempLodgingType) ||
                (stage === "pace" && !tempPace) ||
                (stage === "budget" && !tempBudget)
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
