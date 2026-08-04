"use client";

import { useEffect, useRef, useState } from "react";
import { ChipGroup, Field, Screen, Slider } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { QUICK_CATEGORIES, type QuickCategoryId } from "@/constants/quickCategories";
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";
import { TRIP_TYPE_RULES } from "@/services/tripBuilder/rules";
import type { TripType } from "@/services/tripBuilder/types";
import { AnswerOptions } from "./AnswerOptions";
import { ChatBubble } from "./ChatBubble";
import { TypingIndicator } from "./TypingIndicator";
import { UserBubble } from "./UserBubble";

const INTRO = "שלום! אני טריפי AI 👋\n\nסוכן ה-AI האישי של TRIPLACE.\n\nאני כאן כדי להכיר אתכם, להבין בדיוק מה אתם מחפשים, ולבנות עבורכם חופשה שתוכננה במיוחד בשבילכם — מהיעדים ועד המסלול המושלם.\n\nאז בואו נתחיל!";
const TYPES: Partial<Record<QuickCategoryId, TripType>> = { day_trip: "day_trip", weekend: "weekend", romantic_date: "romantic_date", nature_trip: "nature_trip", abroad: "abroad_vacation", nightlife: "nightlife", restaurants_cafes: "restaurants_cafes" };
type Message = { id: number; role: "assistant" | "user"; text: string };
const label = (options: { value: string; label: string }[], value: string) => options.find((option) => option.value === value)?.label ?? value;

/** Renders the existing rule descriptors in one persistent chat surface. */
export function TrippyConversation() {
  const [messages, setMessages] = useState<Message[]>([{ id: 1, role: "assistant", text: INTRO }]);
  const [type, setType] = useState<TripType | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [value, setValue] = useState<string | null>(null);
  const [values, setValues] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [typing, setTyping] = useState(false);
  const id = useRef(1); const bottom = useRef<HTMLDivElement>(null);
  const questions = type ? TRIP_TYPE_RULES[type]?.questions ?? [] : [];
  const step = questions[index];
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages, typing, type, index, followUp]);
  const add = (role: Message["role"], message: string) => { id.current += 1; setMessages((all) => [...all, { id: id.current, role, text: message }]); };
  const save = (key: string, answer: unknown) => ({ ...answers, [key]: answer });
  function next(nextAnswers: Record<string, unknown>) {
    setAnswers(nextAnswers); setValue(null); setValues([]); setText(""); setFollowUp(false);
    if (index + 1 === questions.length) { add("assistant", "מעולה, קיבלתי את כל הפרטים. אני בונה עבורכם את המסלול עכשיו."); return; }
    setTyping(true); window.setTimeout(() => { setTyping(false); setIndex((current) => current + 1); add("assistant", questions[index + 1].title); }, 400);
  }
function choose(category: QuickCategoryId) {
    const tripType = TYPES[category]; const rule = tripType ? TRIP_TYPE_RULES[tripType] : undefined; if (!tripType || !rule) return;
    setType(tripType); setIndex(0); setAnswers({}); add("user", QUICK_CATEGORY_LABELS[category]); setTyping(true);
    window.setTimeout(() => { setTyping(false); add("assistant", rule.questions[0].title); }, 400);
  }
  function confirm() {
    if (!step) return;
    if (step.type === "companions") {
      if (followUp) { add("user", values.map((item) => label(step.childAgeOptions, item)).join(", ")); next(save(step.childAgeKey, values)); return; }
      if (!value) return; add("user", label(step.options, value)); const nextAnswers = save(step.key, value);
      if (value === step.childAgeTriggerValue) { setAnswers(nextAnswers); setFollowUp(true); add("assistant", step.childAgeTitle); return; }
      next({ ...nextAnswers, [step.childAgeKey]: null }); return;
    }
    if (step.type === "date") { if (!text) return; add("user", text); next(save(step.otherDateKey, text)); return; }
    if (step.type === "slider") { const selected = value ?? step.steps[0]?.value; if (!selected) return; add("user", label(step.steps, selected)); next(save(step.key, selected)); return; }
    if (step.type === "multi-emoji") { add("user", values.map((item) => label(step.options, item)).join(", ")); next(save(step.key, values)); return; }
    if (step.type === "text") { if (!text) return; add("user", text); next(save(step.key, text)); }
  }
  return <Screen withBottomNavSpacing><div className="mx-auto flex max-w-md flex-col gap-4 px-1 pt-5 pb-6">
    {messages.map((message) => message.role === "assistant" ? <ChatBubble key={message.id}>{message.text}</ChatBubble> : <UserBubble key={message.id}>{message.text}</UserBubble>)}
    {!type && <AnswerOptions options={QUICK_CATEGORIES.filter((category) => TYPES[category.id] && TRIP_TYPE_RULES[TYPES[category.id]!]).map((category) => ({ value: category.id, label: QUICK_CATEGORY_LABELS[category.id] }))} onSelect={(selected) => choose(selected as QuickCategoryId)} />}
    {typing && <TypingIndicator />}
    {step && !typing && <div className="flex flex-col gap-3">
      {step.type === "single" && <AnswerOptions options={step.options} onSelect={(selected) => { add("user", label(step.options, selected)); next(save(step.key, selected)); }} />}
      {step.type === "companions" && (followUp ? <ChipGroup options={step.childAgeOptions} selected={values} onChange={setValues} /> : <AnswerOptions options={step.options} selected={value} onSelect={setValue} />)}
      {step.type === "date" && <Field label="בחרו תאריך"><input type="date" value={text} onChange={(event) => setText(event.target.value)} className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-4 py-3 text-sm" /></Field>}
      {step.type === "slider" && <Slider steps={step.steps} value={value ?? step.steps[0]?.value} onChange={setValue} />}
      {step.type === "multi-emoji" && <ChipGroup options={step.options} selected={values} onChange={setValues} />}
      {step.type === "text" && <textarea value={text} placeholder={step.placeholder} onChange={(event) => setText(event.target.value)} rows={3} className="w-full rounded-card border border-ink-secondary/25 bg-bg p-4 text-sm" />}
      {step.type !== "single" && <button type="button" onClick={confirm} className="rounded-pill py-2 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}>המשך</button>}
    </div>}
    <div ref={bottom} />
  </div><MainBottomNav active="ai" /></Screen>;
}
