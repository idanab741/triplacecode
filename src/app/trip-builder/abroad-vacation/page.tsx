"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Screen, ChipGroup, Field, Slider } from "@/components/ui";
import { DateRangePicker } from "@/screens/trip-builder/chat/DateRangePicker";
import { HotelAutocomplete } from "@/screens/trip-builder/chat/HotelAutocomplete";
import { LoadingGame } from "@/screens/trip-builder/LoadingGame";
import {
  VACATION_COMPANION_OPTIONS,
  VACATION_CHILD_AGE_OPTIONS,
  LODGING_TYPE_OPTIONS,
  VACATION_BUDGET_STEPS,
  VACATION_TYPE_OPTIONS,
  VACATION_PACE_OPTIONS,
  TRAVEL_STYLE_OPTIONS,
  FLIGHT_PREFERENCE_OPTIONS,
} from "@/locales/he/abroadVacation";
import type {
  AbroadVacationAnswers,
  FlightInfo,
  HotelInfo,
} from "@/services/tripBuilder/types";
import { TripBuilderHeader } from "@/screens/trip-builder/chat/TripBuilderHeader";
import { ChatBubble } from "@/screens/trip-builder/chat/ChatBubble";
import { UserBubble } from "@/screens/trip-builder/chat/UserBubble";
import { TypingIndicator } from "@/screens/trip-builder/chat/TypingIndicator";
import { AnswerOptions } from "@/screens/trip-builder/chat/AnswerOptions";
import { MainBottomNav } from "@/components/MainBottomNav";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";

type Stage =
  | "dates"
  | "travelStyle"
  | "destination"
  | "companions"
  | "childAges"
  | "bookedQuestion"
  | "flightPreference"
  | "flightsHotels"
  | "lodgingType"
  | "budget"
  | "vacationTypes"
  | "pace"
  | "freeText";

const STAGE_TITLES: Record<Stage, string> = {
  dates: "מתי יוצאים?",
  travelStyle: "איך תרצו לטייל?",
  destination: "איפה החופשה הבאה שלכם?",
  companions: "עם מי אתם נוסעים?",
  childAges: "גילאי הילדים",
  bookedQuestion: "האם כבר הזמנתם טיסה ומלון?",
  flightPreference: "עד כמה תתפשרו על הטיסה שלכם?",
  flightsHotels: "נהדר! ספרו לי על הטיסה והמלון",
  lodgingType: "איזה סוג לינה אתם מחפשים?",
  budget: "תקציב ליחיד",
  vacationTypes: "איזה סוג חופשה אתם מחפשים?",
  pace: "מה קצב הטיול שלכם?",
  freeText: "משהו נוסף שתרצו להוסיף?",
};

const DEFAULT_ANSWERS: AbroadVacationAnswers = {
  companions: "couple",
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

export default function AbroadVacationQuestionnairePage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [stage, setStage] = useState<Stage>("dates");
  const [form, setForm] = useState<AbroadVacationAnswers>(DEFAULT_ANSWERS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // temp state per stage
  const [tempCompanion, setTempCompanion] = useState<string | null>(null);
  const [tempChildAges, setTempChildAges] = useState<string[]>([]);
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
const [tempBooked, setTempBooked] = useState<string | null>(null);
  const [tempFlightPreference, setTempFlightPreference] = useState<string | null>(null);
  const [tempFlights, setTempFlights] = useState<FlightInfo[]>([
    { flightNumber: "", departureTime: "", arrivalTime: "" },
  ]);
  const [tempHotels, setTempHotels] = useState<HotelInfo[]>([{ name: "", address: "" }]);
  const [activeSubTab, setActiveSubTab] = useState<Record<number, "flight" | "hotel">>({ 0: "flight" });
  const [tempLodging, setTempLodging] = useState<string | null>(null);
  const [tempBudget, setTempBudget] = useState<string | null>(null);
  const [tempTypes, setTempTypes] = useState<string[]>([]);
  const [destinationInput, setDestinationInput] = useState("");
  const [destinationOptions, setDestinationOptions] = useState<string[]>([]);
  const [tempDestinations, setTempDestinations] = useState<string[]>([""]);
  const [destinationOptionsMulti, setDestinationOptionsMulti] = useState<Record<number, string[]>>({});
  const [tempPace, setTempPace] = useState<string | null>(null);
  const [tempTravelStyle, setTempTravelStyle] = useState<string | null>(null);
  const [tempFreeText, setTempFreeText] = useState("");



  // עריכת תשובות קודמות - לוחצים על בועת המשתמש כדי לפתוח מחדש את אותה שאלה
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [editTempValue, setEditTempValue] = useState<string | null>(null);
  const [editTempMultiValue, setEditTempMultiValue] = useState<string[]>([]);
  const [editTempStartDate, setEditTempStartDate] = useState("");
  const [editTempEndDate, setEditTempEndDate] = useState("");
  const [editTempFreeText, setEditTempFreeText] = useState("");
  const [editTempDestinationInput, setEditTempDestinationInput] = useState("");
  const [editTempDestinationOptions, setEditTempDestinationOptions] = useState<string[]>([]);
  const [editTempDestinations, setEditTempDestinations] = useState<string[]>([""]);
  const [editTempDestOptionsMulti, setEditTempDestOptionsMulti] = useState<Record<number, string[]>>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const startedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    addBot("שלום! אני טריפי AI 👋\nבואו נתכנן ביחד את החופשה הבאה שלכם בחו\"ל.");
    addIconBadge("חופשה בחו\"ל");
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

  // autocomplete יעד - debounce
  useEffect(() => {
    if (destinationInput.trim().length < 2) {
      setDestinationOptions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/places/cities?q=${encodeURIComponent(destinationInput.trim())}`)
        .then((res) => res.json())
        .then((data) => setDestinationOptions(data.cities ?? []))
        .catch(() => setDestinationOptions([]));
    }, 300);
  }, [destinationInput]);

  // autocomplete יעד - debounce, בזמן עריכת יעד יחיד (destination, כש-travelStyle יחיד)
  useEffect(() => {
    const value = editTempDestinationInput.trim();
    if (value.length < 2) {
      const clearTimer = setTimeout(() => setEditTempDestinationOptions([]), 0);
      return () => clearTimeout(clearTimer);
    }
    const timeout = setTimeout(() => {
      fetch(`/api/places/cities?q=${encodeURIComponent(value)}`)
        .then((res) => res.json())
        .then((data) => setEditTempDestinationOptions(data.cities ?? []))
        .catch(() => setEditTempDestinationOptions([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [editTempDestinationInput]);

  const multiDestDebounceRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  function updateDestinationAt(index: number, value: string) {
    setTempDestinations((list) => {
      const copy = [...list];
      copy[index] = value;
      return copy;
    });
    if (multiDestDebounceRef.current[index]) clearTimeout(multiDestDebounceRef.current[index]);
    if (value.trim().length < 2) {
      setDestinationOptionsMulti((m) => ({ ...m, [index]: [] }));
      return;
    }
    multiDestDebounceRef.current[index] = setTimeout(() => {
      fetch(`/api/places/cities?q=${encodeURIComponent(value.trim())}`)
        .then((res) => res.json())
        .then((data) => setDestinationOptionsMulti((m) => ({ ...m, [index]: data.cities ?? [] })))
        .catch(() => setDestinationOptionsMulti((m) => ({ ...m, [index]: [] })));
    }, 300);
  }

  function selectDestinationAt(index: number, city: string) {
    setTempDestinations((list) => {
      const copy = [...list];
      copy[index] = city;
      return copy;
    });
    setDestinationOptionsMulti((m) => ({ ...m, [index]: [] }));
  }

  function addDestinationRow() {
    setTempDestinations((list) => [...list, ""]);
  }

  function removeDestinationRow(index: number) {
    setTempDestinations((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
    setDestinationOptionsMulti((m) => {
      const copy = { ...m };
      delete copy[index];
      return copy;
    });
  }

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
    setForm((f) => ({ ...f, companions: tempCompanion as AbroadVacationAnswers["companions"] }));
    addUser(labelFor(VACATION_COMPANION_OPTIONS, tempCompanion), "companions");
    if (tempCompanion === "family") {
      goTo("childAges");
    } else {
      goTo("bookedQuestion");
    }
  }

  function confirmChildAges() {
    setForm((f) => ({ ...f, childAgeBands: tempChildAges as AbroadVacationAnswers["childAgeBands"] }));
    addUser(tempChildAges.length > 0 ? labelsFor(VACATION_CHILD_AGE_OPTIONS, tempChildAges).join("، ") : "לא רלוונטי", "childAges");
    goTo("bookedQuestion");
  }

  function confirmDates() {
    if (!tempStartDate || !tempEndDate) return;
    setForm((f) => ({ ...f, startDate: tempStartDate, endDate: tempEndDate }));
    addUser(`${tempStartDate} עד ${tempEndDate}`, "dates");
    goTo("travelStyle");
  }

function confirmBooked() {
    if (!tempBooked) return;
    const booked = tempBooked === "yes";
    setForm((f) => ({ ...f, hasBookedFlightAndHotel: booked }));
    addUser(booked ? "כן" : "לא", "bookedQuestion");
    if (booked) {
      goTo("flightsHotels");
    } else {
      goTo("flightPreference");
    }
  }

  function confirmFlightPreference() {
    if (!tempFlightPreference) return;
    setForm((f) => ({ ...f, flightPreference: tempFlightPreference as AbroadVacationAnswers["flightPreference"] }));
    addUser(labelFor(FLIGHT_PREFERENCE_OPTIONS, tempFlightPreference), "flightPreference");
    goTo("lodgingType");
  }
  function addFlightHotelRow() {
    const nextIndex = tempFlights.length;
    setTempFlights((f) => [...f, { flightNumber: "", departureTime: "", arrivalTime: "" }]);
    setTempHotels((h) => [...h, { name: "", address: "" }]);
    setActiveSubTab((s) => ({ ...s, [nextIndex]: "flight" }));
  }

  function confirmFlightsHotels() {
    setForm((f) => ({ ...f, flights: tempFlights, hotels: tempHotels }));
    addUser(
      tempHotels
        .filter((h) => h.name)
        .map((h) => h.name)
        .join("، ") || "פרטי הטיסה והמלון נקלטו"
    );
    goTo("budget");
  }

  function confirmLodgingType() {
    if (!tempLodging) return;
    setForm((f) => ({ ...f, lodgingType: tempLodging as AbroadVacationAnswers["lodgingType"] }));
    addUser(labelFor(LODGING_TYPE_OPTIONS, tempLodging), "lodgingType");
    goTo("budget");
  }

  function confirmBudget() {
    if (!tempBudget) return;
    setForm((f) => ({ ...f, budgetPerPerson: tempBudget }));
    addUser(labelFor(VACATION_BUDGET_STEPS, tempBudget), "budget");
    goTo("vacationTypes");
  }

  function confirmVacationTypes() {
    setForm((f) => ({ ...f, vacationTypes: tempTypes }));
    addUser(tempTypes.length > 0 ? labelsFor(VACATION_TYPE_OPTIONS, tempTypes).join("، ") : "תפתיעו אותנו", "vacationTypes");
    goTo("pace");
  }

  function selectDestination(city: string) {
    setForm((f) => ({ ...f, destination: city, destinations: [], surpriseMe: false }));
    addUser(city, "destination");
    setDestinationOptions([]);
    goTo("companions");
  }

  function chooseSurpriseMe() {
    setForm((f) => ({ ...f, destination: null, destinations: [], surpriseMe: true }));
    addUser("תפתיעו אותי 🎁", "destination");
    goTo("companions");
  }

  function confirmDestinationsMulti() {
    const cities = tempDestinations.map((c) => c.trim()).filter(Boolean);
    if (cities.length === 0) return;
    setForm((f) => ({ ...f, destination: null, destinations: cities, surpriseMe: false }));
    addUser(cities.join("، "), "destination");
    goTo("companions");
  }

  function confirmPace() {
    if (!tempPace) return;
    setForm((f) => ({ ...f, pace: tempPace as AbroadVacationAnswers["pace"] }));
    addUser(labelFor(VACATION_PACE_OPTIONS, tempPace), "pace");
    goTo("freeText");
  }

  function confirmTravelStyle() {
    if (!tempTravelStyle) return;
    setForm((f) => ({ ...f, travelStyle: tempTravelStyle as AbroadVacationAnswers["travelStyle"] }));
    addUser(labelFor(TRAVEL_STYLE_OPTIONS, tempTravelStyle), "travelStyle");
    goTo("destination");
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
    } else if (message.editStage === "bookedQuestion") setEditTempValue(form.hasBookedFlightAndHotel ? "yes" : "no");
    else if (message.editStage === "flightPreference") setEditTempValue(form.flightPreference ?? "");
    else if (message.editStage === "lodgingType") setEditTempValue(form.lodgingType ?? "");
    else if (message.editStage === "budget") setEditTempValue(form.budgetPerPerson);
    else if (message.editStage === "vacationTypes") setEditTempMultiValue(form.vacationTypes);
    else if (message.editStage === "destination") {
      if (form.travelStyle === "single_destination") {
        setEditTempDestinationInput(form.destination ?? "");
      } else {
        setEditTempDestinations(form.destinations.length > 0 ? form.destinations : [""]);
      }
    } else if (message.editStage === "pace") setEditTempValue(form.pace);
    else if (message.editStage === "travelStyle") setEditTempValue(form.travelStyle);
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
    setEditTempDestinationInput("");
    setEditTempDestinationOptions([]);
    setEditTempDestinations([""]);
    setEditTempDestOptionsMulti({});
  }

  function updateMessageLabel(newLabel: string) {
    setMessages((msgs) => msgs.map((msg) => (msg.id === editingMessageId ? { ...msg, text: newLabel } : msg)));
  }

  /** עריכת יעד יחיד - כמו בזרימה הרגילה, בחירה מהרשימה מאשרת מיד בלי כפתור "עדכן" נפרד. */
  function selectEditDestination(city: string) {
    setForm((f) => ({ ...f, destination: city, destinations: [], surpriseMe: false }));
    updateMessageLabel(city);
    closeEdit();
  }

  function chooseEditSurpriseMe() {
    setForm((f) => ({ ...f, destination: null, destinations: [], surpriseMe: true }));
    updateMessageLabel("תפתיעו אותי 🎁");
    closeEdit();
  }

  function updateEditDestinationAt(index: number, value: string) {
    setEditTempDestinations((list) => {
      const copy = [...list];
      copy[index] = value;
      return copy;
    });
    if (value.trim().length < 2) {
      setEditTempDestOptionsMulti((m) => ({ ...m, [index]: [] }));
      return;
    }
    fetch(`/api/places/cities?q=${encodeURIComponent(value.trim())}`)
      .then((res) => res.json())
      .then((data) => setEditTempDestOptionsMulti((m) => ({ ...m, [index]: data.cities ?? [] })))
      .catch(() => setEditTempDestOptionsMulti((m) => ({ ...m, [index]: [] })));
  }

  function selectEditDestinationAt(index: number, city: string) {
    setEditTempDestinations((list) => {
      const copy = [...list];
      copy[index] = city;
      return copy;
    });
    setEditTempDestOptionsMulti((m) => ({ ...m, [index]: [] }));
  }

  function addEditDestinationRow() {
    setEditTempDestinations((list) => [...list, ""]);
  }

  function removeEditDestinationRow(index: number) {
    setEditTempDestinations((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  function confirmEdit() {
    if (!editingStage || editingMessageId == null) return;

    if (editingStage === "companions") {
      if (!editTempValue) return;
      setForm((f) => ({ ...f, companions: editTempValue as AbroadVacationAnswers["companions"] }));
      updateMessageLabel(labelFor(VACATION_COMPANION_OPTIONS, editTempValue));
    } else if (editingStage === "childAges") {
      setForm((f) => ({ ...f, childAgeBands: editTempMultiValue as AbroadVacationAnswers["childAgeBands"] }));
      updateMessageLabel(editTempMultiValue.length > 0 ? labelsFor(VACATION_CHILD_AGE_OPTIONS, editTempMultiValue).join("، ") : "לא רלוונטי");
    } else if (editingStage === "dates") {
      if (!editTempStartDate || !editTempEndDate) return;
      setForm((f) => ({ ...f, startDate: editTempStartDate, endDate: editTempEndDate }));
      updateMessageLabel(`${editTempStartDate} עד ${editTempEndDate}`);
    } else if (editingStage === "bookedQuestion") {
      if (!editTempValue) return;
      const booked = editTempValue === "yes";
      setForm((f) => ({ ...f, hasBookedFlightAndHotel: booked }));
      updateMessageLabel(booked ? "כן" : "לא");
    } else if (editingStage === "flightPreference") {
      if (!editTempValue) return;
      setForm((f) => ({ ...f, flightPreference: editTempValue as AbroadVacationAnswers["flightPreference"] }));
      updateMessageLabel(labelFor(FLIGHT_PREFERENCE_OPTIONS, editTempValue));
    } else if (editingStage === "lodgingType") {
      if (!editTempValue) return;
      setForm((f) => ({ ...f, lodgingType: editTempValue as AbroadVacationAnswers["lodgingType"] }));
      updateMessageLabel(labelFor(LODGING_TYPE_OPTIONS, editTempValue));
    } else if (editingStage === "budget") {
      if (!editTempValue) return;
      setForm((f) => ({ ...f, budgetPerPerson: editTempValue as string }));
      updateMessageLabel(labelFor(VACATION_BUDGET_STEPS, editTempValue));
    } else if (editingStage === "vacationTypes") {
      setForm((f) => ({ ...f, vacationTypes: editTempMultiValue }));
      updateMessageLabel(editTempMultiValue.length > 0 ? labelsFor(VACATION_TYPE_OPTIONS, editTempMultiValue).join("، ") : "תפתיעו אותנו");
    } else if (editingStage === "destination") {
      // רלוונטי רק למצב multi - מצב single מטופל מיידית ב-selectEditDestination/chooseEditSurpriseMe.
      const cities = editTempDestinations.map((c) => c.trim()).filter(Boolean);
      if (cities.length === 0) return;
      setForm((f) => ({ ...f, destination: null, destinations: cities, surpriseMe: false }));
      updateMessageLabel(cities.join("، "));
    } else if (editingStage === "pace") {
      if (!editTempValue) return;
      setForm((f) => ({ ...f, pace: editTempValue as AbroadVacationAnswers["pace"] }));
      updateMessageLabel(labelFor(VACATION_PACE_OPTIONS, editTempValue));
    } else if (editingStage === "travelStyle") {
      if (!editTempValue) return;
      setForm((f) => ({ ...f, travelStyle: editTempValue as AbroadVacationAnswers["travelStyle"] }));
      updateMessageLabel(labelFor(TRAVEL_STYLE_OPTIONS, editTempValue));
    } else if (editingStage === "freeText") {
      setForm((f) => ({ ...f, freeText: editTempFreeText }));
      updateMessageLabel(editTempFreeText || "—");
    } else {
      return;
    }

    closeEdit();
  }

  /** אחרי "משהו נוסף שתרצו להוסיף" עוברים ישירות לבניית המסלול דרך triplace - בלי מסך בחירה triplace/tripmatch. */
  async function buildTripDirectly(answers: AbroadVacationAnswers) {
    if (!user) {
      router.push("/auth");
      return;
    }
    // מציגים את מסך ההמתנה (עם המשחק) מיד בלחיצה - לא ממתינים לשום קריאת
    // רשת קודם (מיקום/יצירת session) כדי שלא יהיה רגע של "כלום לא קורה".
    setSubmitting(true);
    setLocationError(null);
    try {
      const origin = await getCurrentPosition();
      const response = await fetch("/api/trip-builder/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripType: "abroad_vacation", answers, origin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "יצירת החופשה נכשלה");

      const sessionId = data.session.id;
      // הבנייה בפועל (auto-build - הקריאה הכבדה שבוחרת את כל התחנות) *לא*
      // ממתינים לה כאן: מפעילים אותה ברקע וממשיכים ישר לעמוד התוצאה, שהוא
      // זה שמתשאל את ה-session שוב ושוב עד שהיא מסתיימת. כך המשתמש עובר
      // מיד למסך ההמתנה במקום להיתקע כאן, וה"תנועה" מרגישה מיידית.
      fetch(`/api/trip-builder/sessions/${sessionId}/auto-build`, { method: "POST" }).catch(() => {});
      router.push(`/trip-builder/abroad-vacation/result?sessionId=${sessionId}`);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "לא הצלחנו לבנות את החופשה. נסו שוב.");
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
                  <Image src="/images/categories/cat-abroad.png" alt="" fill className="object-cover" />
                </span>
                <span className="text-[13.5px] font-medium text-white">חופשה בחו"ל</span>
              </div>
              <UserAvatar avatarUrl={profile?.avatar_url ?? null} name={profile?.full_name ?? null} />
            </div>
          ) : editingMessageId === m.id ? (
            <div key={m.id} className="mt-1">
              {editingStage === "companions" && (
                <AnswerOptions
                  options={VACATION_COMPANION_OPTIONS}
                  selected={editTempValue}
                  onSelect={setEditTempValue}
                />
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

              {editingStage === "flightPreference" && (
                <AnswerOptions options={FLIGHT_PREFERENCE_OPTIONS} selected={editTempValue} onSelect={setEditTempValue} />
              )}

              {editingStage === "lodgingType" && (
                <AnswerOptions options={LODGING_TYPE_OPTIONS} selected={editTempValue} onSelect={setEditTempValue} />
              )}

              {editingStage === "budget" && (
                <div className="rounded-card bg-white p-4 shadow-md">
                  <Slider steps={VACATION_BUDGET_STEPS} value={editTempValue ?? VACATION_BUDGET_STEPS[1].value} onChange={setEditTempValue} />
                </div>
              )}

              {editingStage === "vacationTypes" && (
                <ChipGroup options={VACATION_TYPE_OPTIONS} selected={editTempMultiValue} onChange={setEditTempMultiValue} />
              )}

              {editingStage === "destination" && form.travelStyle === "single_destination" && (
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={editTempDestinationInput}
                      onChange={(e) => setEditTempDestinationInput(e.target.value)}
                      placeholder="לדוגמה: ברצלונה, איטליה..."
                      className="w-full rounded-card border border-ink-secondary/25 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    {editTempDestinationOptions.length > 0 && (
                      <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-card bg-white shadow-lg">
                        {editTempDestinationOptions.map((city) => (
                          <button
                            key={city}
                            type="button"
                            onClick={() => selectEditDestination(city)}
                            className="block w-full px-4 py-2.5 text-right text-sm text-ink hover:bg-bg-secondary"
                          >
                            {city}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={chooseEditSurpriseMe}
                    className="w-full rounded-pill border border-accent/30 bg-accent/5 py-2.5 text-sm font-semibold text-accent"
                  >
                    🎁 תפתיעו אותי
                  </button>
                </div>
              )}

              {editingStage === "destination" && form.travelStyle !== "single_destination" && (
                <div className="flex flex-col gap-3">
                  {editTempDestinations.map((value, i) => (
                    <div key={i} className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => updateEditDestinationAt(i, e.target.value)}
                          placeholder={`יעד ${i + 1} - לדוגמה: ברצלונה, איטליה...`}
                          className="w-full rounded-card border border-ink-secondary/25 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                        {(editTempDestOptionsMulti[i]?.length ?? 0) > 0 && (
                          <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-card bg-white shadow-lg">
                            {editTempDestOptionsMulti[i].map((city) => (
                              <button
                                key={city}
                                type="button"
                                onClick={() => selectEditDestinationAt(i, city)}
                                className="block w-full px-4 py-2.5 text-right text-sm text-ink hover:bg-bg-secondary"
                              >
                                {city}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {editTempDestinations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEditDestinationRow(i)}
                          className="shrink-0 rounded-full border border-ink-secondary/25 bg-white px-2.5 py-2 text-xs text-ink-secondary"
                          aria-label="הסרת יעד"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addEditDestinationRow}
                    className="w-fit rounded-pill border border-accent/30 bg-accent/5 px-4 py-2 text-xs font-semibold text-accent"
                  >
                    + הוסיפו יעד
                  </button>
                </div>
              )}

              {editingStage === "pace" && (
                <AnswerOptions
                  options={VACATION_PACE_OPTIONS}
                  selected={editTempValue}
                  onSelect={setEditTempValue}
                />
              )}
              {editingStage === "travelStyle" && (
                <AnswerOptions
                  options={TRAVEL_STYLE_OPTIONS}
                  selected={editTempValue}
                  onSelect={setEditTempValue}
                />
              )}

              {editingStage === "freeText" && (
                <textarea
                  value={editTempFreeText}
                  onChange={(e) => setEditTempFreeText(e.target.value)}
                  placeholder="לדוגמה: ירח דבש, חשוב לנו ים, יעד פחות תיירותי..."
                  rows={3}
                  className="w-full rounded-card border border-ink-secondary/25 bg-bg p-4 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
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
                {/* עריכת יעד יחיד מאשרת מיד בלחיצה (כמו בזרימה הרגילה) - אין כפתור "עדכן" נפרד עבורה */}
                {!(editingStage === "destination" && form.travelStyle === "single_destination") && (
                  <button
                    type="button"
                    onClick={confirmEdit}
                    disabled={
                      (editingStage === "companions" && !editTempValue) ||
                      (editingStage === "dates" && (!editTempStartDate || !editTempEndDate)) ||
                      (editingStage === "bookedQuestion" && !editTempValue) ||
                      (editingStage === "flightPreference" && !editTempValue) ||
                      (editingStage === "lodgingType" && !editTempValue) ||
                      (editingStage === "budget" && !editTempValue) ||
                      (editingStage === "pace" && !editTempValue) ||
                      (editingStage === "travelStyle" && !editTempValue) ||
                      (editingStage === "destination" && editTempDestinations.every((c) => !c.trim()))
                    }
                    className="flex-1 rounded-pill py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
                  >
                    עדכן
                  </button>
                )}
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

            {stage === "flightPreference" && (
              <AnswerOptions
                options={FLIGHT_PREFERENCE_OPTIONS}
                selected={tempFlightPreference}
                onSelect={setTempFlightPreference}
              />
            )}

            {stage === "flightsHotels" && (
              <div className="flex flex-col gap-4">
                {tempFlights.map((flight, i) => {
                  const activeTab = activeSubTab[i] ?? "flight";
                  return (
                    <div key={i} className="flex flex-col gap-3 rounded-card bg-white p-4 shadow-md">
                      <p className="text-xs font-semibold text-ink-secondary">
                        {tempFlights.length > 1 ? `יעד ${i + 1}` : "פרטי הטיול"}
                      </p>

                      <div className="flex rounded-pill bg-bg-secondary p-1">
                        <button
                          type="button"
                          onClick={() => setActiveSubTab((s) => ({ ...s, [i]: "flight" }))}
                          className={`flex-1 rounded-pill py-2 text-sm font-semibold transition ${
                            activeTab === "flight" ? "bg-white text-ink shadow-sm" : "text-ink-secondary"
                          }`}
                        >
                          ✈️ טיסה
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSubTab((s) => ({ ...s, [i]: "hotel" }))}
                          className={`flex-1 rounded-pill py-2 text-sm font-semibold transition ${
                            activeTab === "hotel" ? "bg-white text-ink shadow-sm" : "text-ink-secondary"
                          }`}
                        >
                          🏨 מלון
                        </button>
                      </div>

             {activeTab === "flight" && (
                        <div className="flex flex-col gap-2">
                          <Field label="מספר טיסה (אופציונלי)">
                            <input
                              type="text"
                              value={flight.flightNumber ?? ""}
                              onChange={(e) => {
                                const copy = [...tempFlights];
                                copy[i] = { ...copy[i], flightNumber: e.target.value };
                                setTempFlights(copy);
                              }}
                              placeholder="לדוגמה: LY315"
                              className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-4 py-2.5 text-sm text-ink placeholder:text-ink-secondary"
                            />
                          </Field>
                          <div className="flex gap-2">
                            <Field label="שעת המראה">
                              <input
                                type="time"
                                value={flight.departureTime}
                                onChange={(e) => {
                                  const copy = [...tempFlights];
                                  copy[i] = { ...copy[i], departureTime: e.target.value };
                                  setTempFlights(copy);
                                }}
                                className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-3 py-2.5 text-center text-sm text-ink"
                              />
                            </Field>
                            <Field label="שעת נחיתה">
                              <input
                                type="time"
                                value={flight.arrivalTime}
                                onChange={(e) => {
                                  const copy = [...tempFlights];
                                  copy[i] = { ...copy[i], arrivalTime: e.target.value };
                                  setTempFlights(copy);
                                }}
                                className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-3 py-2.5 text-center text-sm text-ink"
                              />
                            </Field>
                          </div>
                        </div>
                      )}

                      {activeTab === "hotel" && (
                        <Field label="שם המלון">
                          <HotelAutocomplete
                            name={tempHotels[i]?.name ?? ""}
                            address={tempHotels[i]?.address ?? ""}
                            onChange={(name, address) => {
                              const copy = [...tempHotels];
                              copy[i] = { name, address };
                              setTempHotels(copy);
                            }}
                          />
                          {tempHotels[i]?.address && (
                            <p className="mt-1 text-xs text-ink-secondary">{tempHotels[i].address}</p>
                          )}
                        </Field>
                      )}
                    </div>
                  );
                })}
                {tempTravelStyle !== "single_destination" && (
                  <button
                    type="button"
                    onClick={addFlightHotelRow}
                    className="w-fit rounded-pill border border-accent/30 bg-accent/5 px-4 py-2 text-xs font-semibold text-accent"
                  >
                    + הוסיפו עוד טיסה/מלון
                  </button>
                )}
              </div>
            )}

            {stage === "lodgingType" && (
              <AnswerOptions options={LODGING_TYPE_OPTIONS} selected={tempLodging} onSelect={setTempLodging} />
            )}

            {stage === "budget" && (
              <div className="rounded-card bg-white p-4 shadow-md">
                <Slider steps={VACATION_BUDGET_STEPS} value={tempBudget ?? VACATION_BUDGET_STEPS[1].value} onChange={setTempBudget} />
              </div>
            )}

            {stage === "vacationTypes" && (
              <ChipGroup options={VACATION_TYPE_OPTIONS} selected={tempTypes} onChange={setTempTypes} />
            )}

            {stage === "destination" && form.travelStyle === "single_destination" && (
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <input
                    type="text"
                    value={destinationInput}
                    onChange={(e) => setDestinationInput(e.target.value)}
                    placeholder="לדוגמה: ברצלונה, איטליה, יפן.."
                    className="w-full rounded-card border border-ink-secondary/25 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  {destinationOptions.length > 0 && (
                    <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-card bg-white shadow-lg">
                      {destinationOptions.map((city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => selectDestination(city)}
                          className="block w-full px-4 py-2.5 text-right text-sm text-ink hover:bg-bg-secondary"
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={chooseSurpriseMe}
                  className="w-full rounded-pill border border-accent/30 bg-accent/5 py-2.5 text-sm font-semibold text-accent"
                >
                  🎁 תפתיעו אותי
                </button>
              </div>
            )}

            {stage === "destination" && form.travelStyle !== "single_destination" && (
              <div className="flex flex-col gap-3">
                {tempDestinations.map((value, i) => (
                  <div key={i} className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateDestinationAt(i, e.target.value)}
                        placeholder={`יעד ${i + 1} - לדוגמה: ברצלונה, איטליה...`}
                        className="w-full rounded-card border border-ink-secondary/25 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                      {(destinationOptionsMulti[i]?.length ?? 0) > 0 && (
                        <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-card bg-white shadow-lg">
                          {destinationOptionsMulti[i].map((city) => (
                            <button
                              key={city}
                              type="button"
                              onClick={() => selectDestinationAt(i, city)}
                              className="block w-full px-4 py-2.5 text-right text-sm text-ink hover:bg-bg-secondary"
                            >
                              {city}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {tempDestinations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDestinationRow(i)}
                        className="shrink-0 rounded-full border border-ink-secondary/25 bg-white px-2.5 py-2 text-xs text-ink-secondary"
                        aria-label="הסרת יעד"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addDestinationRow}
                  className="w-fit rounded-pill border border-accent/30 bg-accent/5 px-4 py-2 text-xs font-semibold text-accent"
                >
                  + הוסיפו יעד
                </button>
              </div>
            )}

            {stage === "pace" && (
              <AnswerOptions options={VACATION_PACE_OPTIONS} selected={tempPace} onSelect={setTempPace} />
            )}

            {stage === "travelStyle" && (
              <AnswerOptions options={TRAVEL_STYLE_OPTIONS} selected={tempTravelStyle} onSelect={setTempTravelStyle} />
            )}

            {stage === "freeText" && (
              <textarea
                value={tempFreeText}
                onChange={(e) => setTempFreeText(e.target.value)}
                placeholder="לדוגמה: ירח דבש, חשוב לנו ים, יעד פחות תיירותי..."
                rows={3}
                className="w-full rounded-card border border-ink-secondary/25 bg-bg p-4 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            )}
          </div>
        )}

        {submitting && (
          <LoadingGame
            statusText="רגע, בונים לכם את החופשה..."
            steps={[
              "🌍 מוצאים את היעד המושלם בשבילכם",
              "🏛️ בוחרים אטרקציות ופינות מיוחדות",
              "🍽️ מתאימים מסעדות וברים לכל יום",
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
          else if (stage === "bookedQuestion") confirmBooked();
                else if (stage === "flightPreference") confirmFlightPreference();
                else if (stage === "flightsHotels") confirmFlightsHotels();
                else if (stage === "lodgingType") confirmLodgingType();
                else if (stage === "budget") confirmBudget();
                else if (stage === "vacationTypes") confirmVacationTypes();
                else if (stage === "pace") confirmPace();
                else if (stage === "travelStyle") confirmTravelStyle();
                else if (stage === "freeText") confirmFreeText();
                else if (stage === "destination" && form.travelStyle !== "single_destination") confirmDestinationsMulti();
              }}
              disabled={
                (stage === "companions" && !tempCompanion) ||
                (stage === "dates" && (!tempStartDate || !tempEndDate)) ||
(stage === "bookedQuestion" && !tempBooked) ||
                (stage === "flightPreference" && !tempFlightPreference) ||
                (stage === "lodgingType" && !tempLodging) ||
                (stage === "budget" && !tempBudget) ||
                (stage === "pace" && !tempPace) ||
                (stage === "travelStyle" && !tempTravelStyle) ||
                (stage === "destination" && form.travelStyle === "single_destination") ||
                (stage === "destination" &&
                  form.travelStyle !== "single_destination" &&
                  tempDestinations.every((c) => !c.trim()))
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


