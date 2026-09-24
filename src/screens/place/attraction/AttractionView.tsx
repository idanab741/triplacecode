import type { CSSProperties, ReactNode } from "react";
import { MainBottomNav } from "@/components/MainBottomNav";
import { AttractionSaveShareRow } from "../AttractionSaveShareRow";
import { AttractionTopBarPlain } from "./AttractionTopBar";
import { AttractionHero } from "./AttractionHero";
import { AttractionRatingsSummary, GoogleReviewsLink } from "./AttractionRatings";
import { AttractionInfoGroup, AttractionInfoRow } from "./AttractionInfoGroup";
import { AttractionHoursRow } from "./AttractionHoursRow";
import { AttractionLocation } from "./AttractionLocation";
import { PinIcon, WalletIcon, WheelchairIcon } from "./icons";
import type { AttractionData } from "./types";

const INK = { "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties;

const PRICE_LABEL: Record<number, string> = { 1: "זול", 2: "בינוני", 3: "יקר", 4: "יקר מאוד" };

function accessibilityText(a: AttractionData["accessibility"]): string | null {
  const yes = [a.entrance && "כניסה", a.parking && "חניה", a.restroom && "שירותים", a.seating && "ישיבה"].filter(Boolean) as string[];
  if (yes.length > 1) return `${yes.slice(0, -1).join(", ")} ו${yes[yes.length - 1]} נגישים לכיסאות גלגלים`;
  if (yes.length === 1) return `${yes[0]} נגיש${yes[0] === "חניה" || yes[0] === "ישיבה" ? "ה" : ""} לכיסאות גלגלים`;
  if (a.entrance === false) return "הכניסה אינה נגישה לכיסאות גלגלים";
  return null;
}

/**
 * *** עמוד האטרקציה האחיד (בקשה מפורשת - "עמוד אחיד לכל האטרקציות!! הסדר מחייב אצל כולם"):
 * אותו רכיב בדיוק לכל מקור נתונים (places / tripadd), באותו סדר קבוע:
 *  1 בר עליון · 2 תמונה · 3 שמירה/שיתוף · 4 דירוג Google | דירוג triplace · 5 שם · 6 כתובת ·
 *  7 שעות (פתוח/סגור עכשיו) + טווח מחירים · 8 נגישות · 9 קטגוריות (3, AI) · 10 מרחק + מפה ·
 *  11 Waze / Google Maps · 12 דירוגי משתמשי triplace · 13 קישור לדירוגי Google.
 * 6-9 בסגנון פייסבוק: כותרת קצרה + שורות אייקון וטקסט. חלק שאין לו מידע - לא מוצג (לא "לא ידוע").
 */
export function AttractionView({ data, reviews, activeNavTab = "home" }: { data: AttractionData; reviews: ReactNode; activeNavTab?: "home" | "ai" | "favorites" }) {
  const accessibility = accessibilityText(data.accessibility);
  const hasHoursOrPrice = !!data.openingHours || data.priceLevel != null;

  return (
    <div className="min-h-screen bg-white pb-28" style={INK}>
      {/* 1 */}
      <AttractionTopBarPlain />

      {/* 2 - *** בקשה מפורשת ("למה הבר העליון עם רקע לבן?"): התמונה מתחילה מראש המסך ממש, והבר
          השקוף צף מעליה (-mt-16 = גובה הבר: 52px + pb-3) - בדיוק כמו הקאבר בעמוד הפרופיל. כשגוללים,
          הבר מקבל רקע לבן כרגיל (CollapsibleTopBar). */}
      <div className="relative z-0 -mt-16">
        <AttractionHero images={data.imageUrls} name={data.name} />
      </div>

      {/* 3 */}
      <AttractionSaveShareRow
        placeId={data.id}
        placeName={data.name}
        placeType={data.source === "tripadd" ? "tripadd" : "place"}
        imageUrl={data.imageUrls[0] ?? null}
        category={data.categories.join(" ")}
      />

      {/* 4 */}
      <AttractionRatingsSummary
        googleRating={data.googleRating}
        googleRatingCount={data.googleRatingCount}
        triplaceRating={data.triplaceRating}
        triplaceRatingCount={data.triplaceRatingCount}
      />

      {/* 5 */}
      <h1 className="px-5 pt-5 text-[26px] font-bold leading-tight tracking-tight text-ink">{data.name}</h1>

      {/* 6 */}
      {data.address && (
        <AttractionInfoGroup title="כתובת">
          <AttractionInfoRow icon={<PinIcon />}>{data.address}</AttractionInfoRow>
        </AttractionInfoGroup>
      )}

      {/* 7 */}
      {hasHoursOrPrice && (
        <AttractionInfoGroup title="שעות פעילות ומחירים">
          {data.openingHours && <AttractionHoursRow hours={data.openingHours} />}
          {data.priceLevel != null && data.priceLevel > 0 && (
            <AttractionInfoRow icon={<WalletIcon />}>
              <span className="font-semibold">{"₪".repeat(Math.min(4, data.priceLevel))}</span>
              <span className="text-ink-secondary"> · טווח מחירים {PRICE_LABEL[Math.min(4, data.priceLevel)]}</span>
            </AttractionInfoRow>
          )}
        </AttractionInfoGroup>
      )}

      {/* 8 */}
      {accessibility && (
        <AttractionInfoGroup title="נגישות">
          <AttractionInfoRow icon={<WheelchairIcon />}>{accessibility}</AttractionInfoRow>
        </AttractionInfoGroup>
      )}

      {/* 9 */}
      {/* *** בקשה מפורשת ("שייראו כמו קטגוריות, במלבן עם קצוות מעוגלים"): תגיות אמיתיות - משטח אפור
          עדין, טקסט כהה, נקודה סגולה קטנה של המותג. בלי מסגרות ובלי צל. */}
      {data.categories.length > 0 && (
        <AttractionInfoGroup title="קטגוריות">
          <ul className="flex flex-wrap gap-2 pt-1.5">
            {data.categories.map((label) => (
              <li
                key={label}
                className="flex h-9 items-center gap-2 rounded-full bg-[#F1F2F5] pe-3.5 ps-3 text-[14px] font-medium text-ink"
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-places-purple" />
                {label}
              </li>
            ))}
          </ul>
        </AttractionInfoGroup>
      )}

      {/* 10 + 11 */}
      {data.latitude != null && data.longitude != null && (
        <AttractionLocation placeId={data.id} latitude={data.latitude} longitude={data.longitude} />
      )}

      {/* 12 */}
      <section className="px-5 pt-7">
        <h2 className="mb-3 text-[17px] font-bold text-ink">דירוגים של משתמשי triplace</h2>
        {reviews}
      </section>

      {/* 13 */}
      <GoogleReviewsLink rating={data.googleRating} count={data.googleRatingCount} url={data.googleUrl} />

      <MainBottomNav active={activeNavTab} />
    </div>
  );
}
