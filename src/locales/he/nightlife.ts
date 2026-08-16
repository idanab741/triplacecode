import type { StepOption } from "@/services/tripBuilder/types";

export const NIGHTLIFE_COMPANION_OPTIONS: StepOption[] = [
  { value: "couple", label: "זוג", emoji: "💑" },
  { value: "friends", label: "חברים", emoji: "👥" },
  { value: "group", label: "קבוצה", emoji: "👦‍👧‍👩‍👨" },
  { value: "solo", label: "לבד", emoji: "🙋" },
];

export const NIGHTLIFE_GROUP_SIZE_OPTIONS: StepOption[] = [
  { value: "5-10", label: "10-5" },
  { value: "10-20", label: "20-10" },
  { value: "20+", label: "+20" },
];

export const NIGHTLIFE_TIMING_OPTIONS: StepOption[] = [
  { value: "today", label: "הערב" },
  { value: "tomorrow", label: "מחר בערב" },
  { value: "other_date", label: "תאריך אחר" },
];

export const NIGHTLIFE_DISTANCE_STEPS: StepOption[] = [
  { value: "10min", label: "10\u00A0דקות" },
  { value: "20min", label: "20\u00A0דקות" },
  { value: "30min", label: "30\u00A0דקות" },
  { value: "40min", label: "40\u00A0דקות" },
  { value: "50min", label: "50\u00A0דקות" },
  { value: "1h", label: "שעה" },
  { value: "1.5h", label: "שעה\u00A0וחצי" },
  { value: "2h", label: "שעתיים" },
  { value: "2.5h", label: "שעתיים\u00A0וחצי" },
  { value: "3h", label: "3\u00A0שעות" },
  { value: "4h", label: "4\u00A0שעות" },
  { value: "5h", label: "5\u00A0שעות" },
];

export const NIGHTLIFE_BUDGET_STEPS: StepOption[] = [
  { value: "0-100", label: "₪0‑100" },
  { value: "100-300", label: "₪100‑300" },
  { value: "300-600", label: "₪300‑600" },
  { value: "600-1000", label: "₪600‑1,000" },
  { value: "unlimited", label: "ללא הגבלה" },
];

// סוג הבילוי - בחירה מרובה. ה-value כאן הוא זהות ייחודית של סוג הבילוי
// (לא קטגוריית DB) - כדי שבחירה מרובה תעבוד נכון בלי התנגשויות.
// תוקן: 4 האימוג'ים האחרונים (קריוקי/באולינג/סנוקר/ארקייד) היו מוזזים
// אחד ביחס לשני - קריוקי הציג כדור באולינג, באולינג הציג כדור ביליארד,
// סנוקר הציג ג'ויסטיק, וארקייד הציג קוביות. תואם עכשיו למה שכבר מוגדר
// נכון ב-PLACE_TYPE_TAGS (constants/placeTagOptions.ts) - אותו מקור אמת
// שמשמש את האדמין לתיוג אותם סוגי מקומות בדיוק.
export const NIGHTLIFE_VENUE_TYPE_OPTIONS: StepOption[] = [
  { value: "cocktail_bar", label: "בר קוקטיילים", emoji: "🍸" },
  { value: "wine_bar", label: "בר יין", emoji: "🍷" },
  { value: "club", label: "מועדון", emoji: "🎧" },
  { value: "live_show", label: "הופעה חיה", emoji: "🎤" },
  { value: "standup", label: "סטנדאפ", emoji: "🎭" },
  { value: "theater", label: "תיאטרון", emoji: "🎙️" },
  { value: "karaoke", label: "קריוקי", emoji: "🎤" },
  { value: "bowling", label: "באולינג", emoji: "🎳" },
  { value: "snooker", label: "סנוקר", emoji: "🎱" },
  { value: "arcade", label: "בר משחקים / ארקייד", emoji: "🕹️" },
];

// מיפוי מסוג הבילוי (מה שהמשתמש בוחר) לקטגוריית ה-DB בפועל (trip_type_tags group).
// כמה סוגי בילוי חולקים אותה קטגוריה כי אין עדיין תיוג עדין יותר במאגר.
export const NIGHTLIFE_VENUE_TYPE_TO_CATEGORY: Record<string, string> = {
  cocktail_bar: "wineries_dining",
  wine_bar: "wineries_dining",
  club: "attractions_activities",
  live_show: "events_festivals",
  standup: "events_festivals",
  theater: "events_festivals",
  karaoke: "attractions_activities",
  bowling: "attractions_activities",
  snooker: "attractions_activities",
  arcade: "attractions_activities",
};

export const NIGHTLIFE_SURPRISE_ME_OPTION: StepOption = { value: "surprise_me", label: "תפתיעו אותנו", emoji: "🎁" };