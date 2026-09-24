"use client";

import { Suspense, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen } from "@/components/ui";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { MainBottomNav } from "@/components/MainBottomNav";
import { useAuth } from "@/hooks/useAuth";
import { isMainOnboardingComplete, isProfileComplete } from "@/services/profile/profileService";
import {
  isPreferencesComplete,
  savePreferences,
  completePreferences,
} from "@/services/preferences/preferencesService";
import {
  STEPS,
  EMPTY_PREFERENCES_STATE,
  countCategorySelections,
  type PreferencesFormState,
  type TaxonomyFieldKey,
} from "./steps";
import { PREFERENCES_TAXONOMY, type PreferencesTaxonomyCategory } from "@/locales/he/preferencesTaxonomy";
import { DIETARY_RESTRICTIONS, TRANSPORTATION, ACCESSIBILITY_TYPES } from "@/locales/he/preferences";
import { HOME_QUICK_CATEGORIES } from "@/constants/homeQuickCategories";

/**
 * *** שדרוג עיצובי (בקשה מפורשת - "נשדרג לפי העיצוב החדש של העמודים שלנו, צבעים חדים יותר,
 * ולהשתמש באייקונים של כל סוג טיול"): אותו קו כמו עמוד האטרקציה - רקע לבן נקי, טקסט שחור חד,
 * משטחים אפורים מלאים, כחול triplace אחיד ומלא (בלי גרדיאנטים דהויים).
 *  - במקום פס ההתקדמות: שורת אייקוני סוגי הטיול (אותם אייקונים כמו בעמוד הבית) - רואים באיזה
 *    סוג טיול נמצאים, בכמה כבר בחרתם, ולחיצה על אייקון קופצת ישר אליו.
 *  - קבוצות: שורות עם עיגול סימון (כמו רשימת בחירה), החץ פותח את התגיות הספציפיות.
 * הלוגיקה (שמירה, דילוג, השלמה, הפניות) לא השתנתה.
 */
const BLUE = "#0A6DFE";
const INK = { "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties;

/** אותם אייקוני-תמונה בדיוק כמו שורת "סוגי הטיול" בעמוד הבית. */
const CATEGORY_ICON_SRC: Record<TaxonomyFieldKey, string> = Object.fromEntries(
  HOME_QUICK_CATEGORIES.map((c) => [c.id, c.imageSrc])
) as Record<TaxonomyFieldKey, string>;

/** שם קצר מתחת לאייקון בשורת סוגי הטיול (השם המלא מופיע בכותרת). */
const SHORT_LABEL: Record<TaxonomyFieldKey, string> = {
  food: "אוכל",
  attraction: "אטרקציות",
  nature: "טבע",
  shopping: "קניות",
  sleep: "לינה",
  nightlife: "חיי לילה",
};

function CheckIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2z" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="transition-transform duration-300"
      style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** תגית בחירה - משטח אפור / כחול מלא כשנבחרה. */
function TagChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-medium transition active:scale-95 ${
        selected ? "text-white" : "bg-[#F1F2F5] text-ink"
      }`}
      style={selected ? { background: BLUE } : undefined}
    >
      {selected && <CheckIcon size={12} />}
      {label}
    </button>
  );
}

/** שורת סוגי הטיול - אייקון לכל שלב, טבעת כחולה סביב הנוכחי, תג כחול עם מספר הבחירות. */
function TripTypeStrip({
  stepIndex,
  counts,
  onJump,
}: {
  stepIndex: number;
  counts: number[];
  onJump: (index: number) => void;
}) {
  return (
    <nav aria-label="סוגי טיול" className="flex justify-between gap-1 pb-1 pt-1">
      {STEPS.map((s, i) => {
        const current = i === stepIndex;
        const count = counts[i];
        const label = s.type === "taxonomy" ? SHORT_LABEL[s.key] : "עוד";
        return (
          <button
            key={s.type === "taxonomy" ? s.key : "extra"}
            type="button"
            onClick={() => onJump(i)}
            aria-current={current ? "step" : undefined}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 transition active:scale-95"
          >
            <span className="relative">
              <span
                className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#F1F2F5] text-ink transition-shadow ${
                  current ? "" : "opacity-80"
                }`}
                style={current ? { boxShadow: `0 0 0 2.5px #fff, 0 0 0 4.5px ${BLUE}` } : undefined}
              >
                {s.type === "taxonomy" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={CATEGORY_ICON_SRC[s.key]} alt="" className="h-full w-full scale-125 object-cover" />
                ) : (
                  <CompassIcon />
                )}
              </span>
              {count > 0 && (
                <span
                  className="absolute -bottom-1 -start-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold text-white ring-2 ring-white tabular-nums"
                  style={{ background: BLUE }}
                >
                  {count}
                </span>
              )}
            </span>
            <span className={`w-full truncate text-center text-[11px] leading-tight ${current ? "font-bold text-ink" : "font-medium text-ink-secondary"}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * קבוצת-משנה אחת: לחיצה על השורה = בחירה/ביטול של הקבוצה כולה (עיגול סימון כחול).
 * לחיצה על החץ = פתיחה/סגירה של התגיות הספציפיות, בלי לשנות את הבחירה.
 */
function GroupRow({
  group,
  tags,
  groupSelected,
  selectedTagsCount,
  isExpanded,
  selectedTags,
  index,
  onToggleGroup,
  onToggleExpand,
  onToggleTag,
}: {
  group: string;
  tags: string[];
  groupSelected: boolean;
  selectedTagsCount: number;
  isExpanded: boolean;
  selectedTags: string[];
  index: number;
  onToggleGroup: () => void;
  onToggleExpand: () => void;
  onToggleTag: (tag: string) => void;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl opacity-0 transition-colors ${groupSelected ? "bg-[#EEF4FF]" : "bg-[#F4F5F7]"}`}
      style={{
        boxShadow: groupSelected ? `inset 0 0 0 1.5px ${BLUE}` : undefined,
        animation: "prefFadeInUp 0.35s ease forwards",
        animationDelay: `${index * 35}ms`,
      }}
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggleGroup}
          aria-pressed={groupSelected}
          className="flex min-h-[54px] flex-1 items-center gap-3 py-2.5 pe-1 ps-4 text-start transition active:opacity-70"
        >
          <span
            className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full transition-colors ${
              groupSelected ? "text-white" : "bg-white shadow-[inset_0_0_0_1.5px_rgba(15,20,25,0.22)]"
            }`}
            style={groupSelected ? { background: BLUE } : undefined}
          >
            {groupSelected && <CheckIcon size={12} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-snug text-ink">{group}</span>
            {selectedTagsCount > 0 && (
              <span className="block text-[12.5px] font-semibold" style={{ color: BLUE }}>
                {selectedTagsCount === 1 ? "נבחרה אפשרות אחת" : `נבחרו ${selectedTagsCount} אפשרויות`}
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? `סגירת האפשרויות של ${group}` : `עוד אפשרויות ב${group}`}
          className="flex h-[54px] shrink-0 items-center gap-1 pe-3.5 ps-2 text-[12.5px] font-medium text-ink-secondary"
        >
          {tags.length}
          <ChevronIcon expanded={isExpanded} />
        </button>
      </div>

      <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-2 border-t border-black/[0.06] px-4 pb-4 pt-3">
            {tags.map((tag) => (
              <TagChip key={tag} label={tag} selected={selectedTags.includes(tag)} onClick={() => onToggleTag(tag)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** כותרת קטע בסגנון עמוד האטרקציה: אייקון + כותרת מודגשת. */
function ExtraSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-black/[0.06] pt-5 first:border-t-0 first:pt-0">
      <h2 className="mb-3 flex items-center gap-2.5 text-[17px] font-bold text-ink">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F2F5] text-ink">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const svgProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

function CarIcon() {
  return (
    <svg {...svgProps}>
      <path d="M5 17h14M6.5 17v2M17.5 17v2M4 13l1.8-5A2 2 0 0 1 7.7 6.6h8.6a2 2 0 0 1 1.9 1.4L20 13v4H4v-4zM4 13h16" />
      <circle cx="7.5" cy="14.8" r=".6" />
      <circle cx="16.5" cy="14.8" r=".6" />
    </svg>
  );
}

function ForkIcon() {
  return (
    <svg {...svgProps}>
      <path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2 1.5-3 4-3 7v3h3" />
    </svg>
  );
}

function WheelchairIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="10" cy="4.5" r="1.6" />
      <path d="M10 8v5h5l2.5 5M10 10.5H14M7.5 11.2A5 5 0 1 0 14 18" />
    </svg>
  );
}

function PreferencesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const {
    user,
    loading,
    profile,
    profileLoading,
    preferences,
    preferencesLoading,
    refreshPreferences,
  } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<PreferencesFormState>(EMPTY_PREFERENCES_STATE);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  // *** תוספת (בקשה מפורשת - "נגישות - צריך לסמן אם צריך! לא שזה יופיע
  // לכולם!"): שער - סוגי הנגישות מוצגים רק אחרי שהמשתמש מסמן שיש לו
  // בכלל צורך בהתאמת נגישות, לא מוצגים כברירת מחדל לכולם. מאותחל
  // לפי קיום בחירות קודמות (accessibility_types), לא שדה נפרד ב-DB.
  const [accessibilityNeeded, setAccessibilityNeeded] = useState(false);

  if (!preferencesLoading && !initialized) {
    setInitialized(true);
    setForm({
      taxonomy: preferences?.taxonomy_selections ?? EMPTY_PREFERENCES_STATE.taxonomy,
      transportation: preferences?.transportation ?? [],
      dietary_restrictions: preferences?.dietary_restrictions ?? [],
      kosher: preferences?.kosher ?? false,
      accessibility_types: preferences?.accessibility_types ?? [],
    });
    setAccessibilityNeeded((preferences?.accessibility_types ?? []).length > 0);
  }

  useEffect(() => {
    if (!loading && !profileLoading && user && !isProfileComplete(profile)) {
      router.replace("/profile-setup");
    }
  }, [loading, profileLoading, user, profile, router]);

  useEffect(() => {
    if (loading || profileLoading || !user || !isProfileComplete(profile)) return;
    if (!isMainOnboardingComplete(profile)) {
      router.replace("/onboarding");
    }
  }, [loading, profileLoading, user, profile, router]);

  useEffect(() => {
    if (!preferencesLoading && isPreferencesComplete(preferences) && !returnTo) {
      if (!isMainOnboardingComplete(profile)) return;
      router.replace("/home");
    }
  }, [preferencesLoading, preferences, returnTo, router, profile]);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const currentCategory: PreferencesTaxonomyCategory | null =
    step.type === "taxonomy" ? PREFERENCES_TAXONOMY.find((c) => c.id === step.key) ?? null : null;

  function toggleGroup(categoryId: TaxonomyFieldKey, group: string) {
    setForm((f) => {
      const current = f.taxonomy[categoryId];
      const nextGroups = current.groups.includes(group)
        ? current.groups.filter((g) => g !== group)
        : [...current.groups, group];
      return { ...f, taxonomy: { ...f.taxonomy, [categoryId]: { ...current, groups: nextGroups } } };
    });
  }

  function toggleTag(categoryId: TaxonomyFieldKey, tag: string) {
    setForm((f) => {
      const current = f.taxonomy[categoryId];
      const nextTags = current.tags.includes(tag) ? current.tags.filter((t) => t !== tag) : [...current.tags, tag];
      return { ...f, taxonomy: { ...f.taxonomy, [categoryId]: { ...current, tags: nextTags } } };
    });
  }

  function toggleExpand(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAccessibilityNeeded(needed: boolean) {
    setAccessibilityNeeded(needed);
    if (!needed) setForm((f) => ({ ...f, accessibility_types: [] }));
  }

  function toggleListValue(key: "transportation" | "dietary_restrictions" | "accessibility_types", value: string) {
    setForm((f) => {
      const list = f[key];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...f, [key]: next };
    });
  }

  async function advance(updatedForm: PreferencesFormState, markComplete: boolean) {
    if (!user) return;
    setForm(updatedForm);
    setSaving(true);

    // accessibility (boolean) נגזר אוטומטית מ-accessibility_types, כי עדיין
    // נקרא ישירות במקומות אחרים באפליקציה (matching/ranking/travel DNA).
    const accessibility = updatedForm.accessibility_types.length > 0;

    if (markComplete) {
      await completePreferences(user.id, {
        taxonomy_selections: updatedForm.taxonomy,
        transportation: updatedForm.transportation,
        dietary_restrictions: updatedForm.dietary_restrictions,
        kosher: updatedForm.kosher,
        accessibility,
        accessibility_types: updatedForm.accessibility_types,
      });
    } else if (step.type === "taxonomy") {
      await savePreferences(user.id, { taxonomy_selections: updatedForm.taxonomy });
    } else {
      await savePreferences(user.id, {
        transportation: updatedForm.transportation,
        dietary_restrictions: updatedForm.dietary_restrictions,
        kosher: updatedForm.kosher,
        accessibility,
        accessibility_types: updatedForm.accessibility_types,
      });
    }

    setSaving(false);

    if (markComplete) {
      await refreshPreferences();
      router.push(returnTo || "/home");
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function handleNext() {
    advance(form, isLastStep);
  }

  function handleSkip() {
    const cleared: PreferencesFormState =
      step.type === "taxonomy"
        ? { ...form, taxonomy: { ...form.taxonomy, [step.key]: { groups: [], tags: [] } } }
        : { ...form, transportation: [], dietary_restrictions: [], kosher: false, accessibility_types: [] };
    if (step.type === "extra") setAccessibilityNeeded(false);
    advance(cleared, isLastStep);
  }

  function handleBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  const currentSelectionCount =
    step.type === "taxonomy"
      ? countCategorySelections(form.taxonomy[step.key])
      : form.transportation.length + form.dietary_restrictions.length + form.accessibility_types.length;

  const nextDisabled = saving || (step.type === "taxonomy" && currentSelectionCount === 0);

  /** מספר הבחירות בכל שלב - לתגים הכחולים בשורת סוגי הטיול. */
  const stepCounts = STEPS.map((st) =>
    st.type === "taxonomy"
      ? countCategorySelections(form.taxonomy[st.key])
      : form.transportation.length + form.dietary_restrictions.length + form.accessibility_types.length + (form.kosher ? 1 : 0)
  );

  /** קפיצה ישירה לסוג טיול מהשורה העליונה - הבחירות שכבר נעשו נשמרות ברקע, כדי שלא ילכו לאיבוד. */
  function jumpTo(index: number) {
    if (index === stepIndex || saving) return;
    if (user) {
      const accessibility = form.accessibility_types.length > 0;
      void savePreferences(user.id, {
        taxonomy_selections: form.taxonomy,
        transportation: form.transportation,
        dietary_restrictions: form.dietary_restrictions,
        kosher: form.kosher,
        accessibility,
        accessibility_types: form.accessibility_types,
      });
    }
    setStepIndex(index);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading || profileLoading || preferencesLoading || !initialized) {
    return (
      <Screen withBottomNavSpacing={false}>
        <p className="pt-10 text-center text-ink-secondary">טוען...</p>
      </Screen>
    );
  }

  return (
    <Screen withBottomNavSpacing className="!bg-white !px-0 !pt-0">
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => (stepIndex > 0 ? handleBack() : router.push(returnTo || "/home"))} />

      <div className="mx-auto flex max-w-xl flex-col px-5 pb-6 pt-4" style={INK}>
        <TripTypeStrip stepIndex={stepIndex} counts={stepCounts} onJump={jumpTo} />

        <header key={stepIndex} className="mt-5 flex items-center gap-3.5 opacity-0" style={{ animation: "prefPopIn 0.3s ease forwards" }}>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F1F2F5] text-ink">
            {currentCategory ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={CATEGORY_ICON_SRC[currentCategory.id]} alt="" className="h-full w-full scale-125 object-cover" />
            ) : (
              <CompassIcon />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-ink-secondary tabular-nums">
              שלב {stepIndex + 1} מתוך {STEPS.length}
            </p>
            <h1 className="text-[24px] font-bold leading-tight tracking-tight text-ink">
              {currentCategory ? currentCategory.label : "עוד כמה דברים חשובים"}
            </h1>
          </div>
        </header>
        <p className="mt-2 text-[14px] leading-snug text-ink-secondary">
          {currentCategory
            ? "סמנו מה אתם אוהבים. החץ פותח אפשרויות מדויקות יותר בתוך כל קבוצה."
            : "כדי שנוכל להתאים לכם המלצות מדויקות עוד יותר."}
        </p>

        {step.type === "taxonomy" && currentCategory && (
          <div className="mt-5 flex flex-col gap-2">
            {currentCategory.groups.map((g, i) => {
              const key = `${currentCategory.id}::${g.group}`;
              const selection = form.taxonomy[currentCategory.id];
              const selectedTagsInGroup = g.tags.filter((t) => selection.tags.includes(t));
              return (
                <GroupRow
                  key={key}
                  group={g.group}
                  tags={g.tags}
                  index={i}
                  groupSelected={selection.groups.includes(g.group)}
                  selectedTagsCount={selectedTagsInGroup.length}
                  selectedTags={selection.tags}
                  isExpanded={expandedGroups.has(key)}
                  onToggleGroup={() => toggleGroup(currentCategory.id, g.group)}
                  onToggleExpand={() => toggleExpand(key)}
                  onToggleTag={(tag) => toggleTag(currentCategory.id, tag)}
                />
              );
            })}
          </div>
        )}

        {step.type === "extra" && (
          <div className="mt-6 flex flex-col gap-5">
            <ExtraSection icon={<CarIcon />} title="איך אתם מתניידים?">
              <div className="flex flex-wrap gap-2">
                {TRANSPORTATION.map((option) => (
                  <TagChip
                    key={option.value}
                    label={option.label}
                    selected={form.transportation.includes(option.value)}
                    onClick={() => toggleListValue("transportation", option.value)}
                  />
                ))}
              </div>
            </ExtraSection>

            <ExtraSection icon={<ForkIcon />} title="העדפות אוכל">
              <div className="flex flex-wrap gap-2">
                {DIETARY_RESTRICTIONS.map((option) => {
                  const isKosher = option.value === "kosher";
                  const selected = isKosher ? form.kosher : form.dietary_restrictions.includes(option.value);
                  return (
                    <TagChip
                      key={option.value}
                      label={option.label}
                      selected={selected}
                      onClick={() =>
                        isKosher ? setForm((f) => ({ ...f, kosher: !f.kosher })) : toggleListValue("dietary_restrictions", option.value)
                      }
                    />
                  );
                })}
              </div>
            </ExtraSection>

            {/* נגישות: מתג לכולם, ורשימת הסוגים רק אחרי שמסמנים שיש צורך (בקשה קודמת - "לא שזה יופיע לכולם"). */}
            <ExtraSection icon={<WheelchairIcon />} title="נגישות">
              <button
                type="button"
                role="switch"
                aria-checked={accessibilityNeeded}
                onClick={() => toggleAccessibilityNeeded(!accessibilityNeeded)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl bg-[#F4F5F7] px-4 py-3.5 text-start"
              >
                <span className="text-[15px] font-medium text-ink">יש לי צורך בהתאמות נגישות</span>
                <span
                  className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
                  style={{ background: accessibilityNeeded ? BLUE : "#D5D9E0" }}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-all ${
                      accessibilityNeeded ? "end-0.5" : "start-0.5"
                    }`}
                  />
                </span>
              </button>

              <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: accessibilityNeeded ? "1fr" : "0fr" }}>
                <div className="overflow-hidden">
                  <p className="mb-2.5 mt-3.5 text-[13px] leading-snug text-ink-secondary">
                    סמנו אילו סוגי נגישות חשובים לכם, ונציג רק מקומות שבאמת מתאימים.
                  </p>
                  <div className="flex flex-wrap gap-2 pb-1">
                    {ACCESSIBILITY_TYPES.map((option) => (
                      <TagChip
                        key={option.value}
                        label={option.emoji ? `${option.emoji} ${option.label}` : option.label}
                        selected={form.accessibility_types.includes(option.value)}
                        onClick={() => toggleListValue("accessibility_types", option.value)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </ExtraSection>
          </div>
        )}

        <div className="mt-7 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleNext}
            disabled={nextDisabled}
            className="h-12 rounded-xl text-[15.5px] font-semibold w-full text-white transition active:scale-[0.98] disabled:opacity-40"
            style={{ background: BLUE }}
          >
            {saving ? "שומרים..." : isLastStep ? "סיום" : "הבא"}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="h-11 w-full rounded-xl text-[14.5px] font-medium text-ink-secondary transition active:bg-black/[0.04]"
          >
            דלג על השלב
          </button>
        </div>
      </div>

      <MainBottomNav active="profile" />

      <style jsx>{`
        @keyframes prefFadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes prefPopIn {
          from {
            opacity: 0;
            transform: scale(0.94) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </Screen>
  );
}

export default function PreferencesPage() {
  return (
    <Suspense
      fallback={
        <Screen withBottomNavSpacing={false}>
          <p className="pt-10 text-center text-ink-secondary">טוען...</p>
        </Screen>
      }
    >
      <PreferencesPageContent />
    </Suspense>
  );
}
