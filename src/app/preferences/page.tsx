"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Chip, Screen, Stepper, Switch } from "@/components/ui";
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

const PRIMARY_GRADIENT = "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))";

/** אותם אייקוני-תמונה בדיוק כמו שורת "סוגי הטיול" בעמוד הבית (בקשה מפורשת
 *  - "יש תמונת אייקון לכל סוג טיול! תשתמש גם בהם! זה מופיע בעמוד הבית"),
 *  במקום אימוג'י גנרי. HomeQuickCategoryId ו-TripAddCategory אותו מרחב ערכים. */
const CATEGORY_ICON_SRC: Record<TaxonomyFieldKey, string> = Object.fromEntries(
  HOME_QUICK_CATEGORIES.map((c) => [c.id, c.imageSrc])
) as Record<TaxonomyFieldKey, string>;

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform duration-300"
      style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * כרטיס קבוצת-משנה אחת - בנוי כהרחבה של סגנון ה-Chip הקיים באפליקציה
 * (אותה גלולה מעוגלת, אותו גרדיאנט כחול/צל כשנבחר) ולא כקומפוננטה
 * חדשה המצאתית, בדיוק כדי לענות על ההערה "נראה קצת חובבנית, צריך
 * שיותאם לקווים של האפליקציה שלנו". לחיצה על גוף הגלולה = בחירה/ביטול
 * של הקבוצה כולה. לחיצה על החץ בקצה = פתיחה/סגירה של תתי-התגיות, בלי
 * לשנות את הבחירה.
 */
function GroupPill({
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
      className="overflow-hidden rounded-card opacity-0"
      style={{
        background: groupSelected ? PRIMARY_GRADIENT : "white",
        boxShadow: groupSelected ? "0 4px 12px rgba(24,119,242,0.28)" : "0 2px 8px rgba(16,24,40,0.08)",
        animation: "prefFadeInUp 0.4s ease forwards",
        animationDelay: `${index * 45}ms`,
      }}
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggleGroup}
          className={`flex flex-1 items-center justify-between gap-2 py-2.5 pe-2 ps-4 text-right font-medium transition active:opacity-70 ${
            groupSelected ? "text-white" : "text-ink"
          }`}
        >
          <span className="text-[13.5px]">{group}</span>
          {selectedTagsCount > 0 && (
            <span
              className={`shrink-0 rounded-pill px-2 py-0.5 text-[10.5px] font-bold ${
                groupSelected ? "bg-white/25 text-white" : "text-white"
              }`}
              style={groupSelected ? undefined : { background: PRIMARY_GRADIENT }}
            >
              {selectedTagsCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={isExpanded ? "סגור תתי-קטגוריות" : "פתח תתי-קטגוריות"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center ${groupSelected ? "text-white" : "text-ink-secondary"}`}
        >
          <ChevronIcon expanded={isExpanded} />
        </button>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={`flex flex-wrap gap-1.5 px-3.5 pb-3 pt-1 ${groupSelected ? "border-t border-white/20" : "border-t border-ink-secondary/10"}`}
          >
            {tags.map((tag) => (
              <Chip key={tag} size="sm" selected={selectedTags.includes(tag)} onClick={() => onToggleTag(tag)}>
                {tag}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </div>
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

  if (loading || profileLoading || preferencesLoading || !initialized) {
    return (
      <Screen withBottomNavSpacing={false}>
        <p className="pt-10 text-center text-ink-secondary">טוען...</p>
      </Screen>
    );
  }

  return (
    <Screen withBottomNavSpacing className="!bg-bg !px-0 !pt-0">
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => (stepIndex > 0 ? handleBack() : router.push(returnTo || "/home"))} />

      <div className="mx-auto flex max-w-xl flex-col gap-5 px-5 pb-4 pt-5">
        <Stepper current={stepIndex + 1} total={STEPS.length} />

        <header key={stepIndex} className="text-center opacity-0" style={{ animation: "prefPopIn 0.35s ease forwards" }}>
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-bg-secondary shadow-soft">
            {currentCategory ? (
              <Image
                src={CATEGORY_ICON_SRC[currentCategory.id]}
                alt=""
                width={64}
                height={64}
                className="h-full w-full scale-125 object-cover"
              />
            ) : (
              <span className="text-3xl">🧭</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-ink">{currentCategory ? currentCategory.label : "עוד כמה דברים חשובים"}</h1>
          <p className="mt-1.5 px-4 text-[12.5px] leading-snug text-ink-secondary">
            {currentCategory
              ? "גע כדי לבחור, ולחץ על החץ כדי לגלות עוד אפשרויות בפנים"
              : "כדי שנוכל להתאים לך המלצות מדויקות עוד יותר"}
          </p>
        </header>

        {step.type === "taxonomy" && currentCategory && (
          <div className="flex flex-col gap-2">
            {currentCategory.groups.map((g, i) => {
              const key = `${currentCategory.id}::${g.group}`;
              const selection = form.taxonomy[currentCategory.id];
              const selectedTagsInGroup = g.tags.filter((t) => selection.tags.includes(t));
              return (
                <GroupPill
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
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2.5 text-center text-sm font-semibold text-ink">מהי דרך ההתניידות המועדפת עליך?</p>
              <div className="flex flex-wrap justify-center gap-2">
                {TRANSPORTATION.map((option) => (
                  <Chip
                    key={option.value}
                    selected={form.transportation.includes(option.value)}
                    onClick={() => toggleListValue("transportation", option.value)}
                  >
                    {option.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="border-t border-ink-secondary/10 pt-4">
              <p className="mb-2.5 text-center text-sm font-semibold text-ink">העדפות אוכל מיוחדות</p>
              <div className="flex flex-wrap justify-center gap-2">
                {DIETARY_RESTRICTIONS.map((option) => {
                  const isKosher = option.value === "kosher";
                  const selected = isKosher ? form.kosher : form.dietary_restrictions.includes(option.value);
                  return (
                    <Chip
                      key={option.value}
                      selected={selected}
                      onClick={() =>
                        isKosher
                          ? setForm((f) => ({ ...f, kosher: !f.kosher }))
                          : toggleListValue("dietary_restrictions", option.value)
                      }
                    >
                      {option.label}
                    </Chip>
                  );
                })}
              </div>
            </div>

            {/* *** תוספת (בקשה מפורשת - "נגישות - צריך לסמן אם צריך! לא
                שזה יופיע לכולם!"): שער - כותרת + מתג בלבד לכולם; רשימת
                סוגי הנגישות הספציפיים מוצגת רק אחרי שמסמנים שיש צורך. */}
            <div className="border-t border-ink-secondary/10 pt-4">
              <Switch checked={accessibilityNeeded} onChange={toggleAccessibilityNeeded} label="יש לי צורך בהתאמות נגישות בטיול" />

              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: accessibilityNeeded ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <p className="mx-auto mb-2.5 mt-3 max-w-[280px] text-center text-[11.5px] leading-snug text-ink-secondary">
                    סמן/י אילו סוגי נגישות חשובים לך - כדי שנציג לך רק מקומות שבאמת מתאימים
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pb-1">
                    {ACCESSIBILITY_TYPES.map((option) => (
                      <Chip
                        key={option.value}
                        selected={form.accessibility_types.includes(option.value)}
                        onClick={() => toggleListValue("accessibility_types", option.value)}
                      >
                        {option.emoji ? `${option.emoji} ${option.label}` : option.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleNext}
          disabled={nextDisabled}
          className="rounded-pill py-2 text-sm font-semibold text-white shadow-md transition disabled:opacity-50"
          style={{ background: PRIMARY_GRADIENT }}
        >
          {isLastStep ? "סיום" : "הבא"}
        </button>

        <button type="button" onClick={handleSkip} disabled={saving} className="text-center text-sm text-ink-secondary">
          דלג
        </button>
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
