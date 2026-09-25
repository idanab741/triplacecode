"use client";

import dynamic from "next/dynamic";
import type { CSSProperties, ReactNode } from "react";
import { PostCard } from "@/screens/places/PostCard";
import type { FeedItemDto } from "@/services/social/feedService";
import type { JourneyMarker } from "@/screens/journey/journeyUtils";

const JourneyMap = dynamic(() => import("@/screens/journey/JourneyMap").then((m) => m.JourneyMap), { ssr: false });

/**
 * *** בקשה מפורשת ("הביקורות צריכות להיות כמו בעמודים... המפה כמו המפה ב-places... שייראה מקצועי ורציני"):
 * כל סוג העלאה בעמוד התוכן מציג את **הרכיבים האמיתיים** של האפליקציה עם נתוני דוגמה - אותו PostCard של
 * הפיד (רגע / מקום) ואותה מפה של places (JourneyMap - אותם נעצים) ל"מפה". כך
 * הדוגמה תמיד נראית בדיוק כמו התוצאה, וכל שינוי עיצובי בפיד/במפה מתעדכן כאן לבד. רק תצוגה - בלי לחיצות.
 *
 * כל התמונות של הדוגמאות מרוכזות כאן (PREVIEW_IMAGES) - להחלפה בתמונות מעוצבות.
 */
export const PREVIEW_IMAGES = {
  momentPhoto: "/images/vacation-destinations/telaviv.png",
  placePhoto: "/images/vacation-destinations/haifa.png",
  /** נעצי התמונה במפה לדוגמה - 4 בתי קפה */
  mapPins: [
    "/images/vacation-destinations/telaviv.png",
    "/images/vacation-destinations/eilat.png",
    "/images/vacation-destinations/jerusalem.png",
    "/images/vacation-destinations/tiberias.png",
  ],
  avatarMoment: null as string | null,
  avatarPlace: null as string | null,
};

const noop = async () => true;
const noopVoid = async () => {};

function author(id: string, fullName: string, username: string, avatarUrl: string | null) {
  return { id, username, fullName, avatarUrl, isCreator: false };
}

const POST: FeedItemDto = {
  id: "preview-post",
  type: "post",
  createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  text: "שקיעה מושלמת בחוף 🌅 חייבים לבוא לפה בערב",
  author: author("preview-a", "נועה לוי", "noa", PREVIEW_IMAGES.avatarMoment),
  media: [{ id: "m1", type: "image", url: PREVIEW_IMAGES.momentPhoto, thumbnailUrl: null, width: 1200, height: 900 }],
  place: { id: "preview-place", name: "חוף הצוק", imageUrl: null },
  destination: null,
  stats: { likes: 128, comments: 12, saves: 9 },
  likers: [],
  viewerState: { liked: true, saved: false, following: true, isSelf: false },
  nextCursor: null,
};

const REVIEW: FeedItemDto = {
  id: "preview-review",
  type: "review",
  createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  text: "הקרואסון הכי טוב שאכלתי, והנוף מהמרפסת מטורף. שווה להגיע מוקדם בבוקר ⭐⭐⭐⭐⭐",
  author: author("preview-b", "עומר כהן", "omer", PREVIEW_IMAGES.avatarPlace),
  media: [{ id: "m2", type: "image", url: PREVIEW_IMAGES.placePhoto, thumbnailUrl: null, width: 1200, height: 900 }],
  place: { id: "preview-place-2", name: "קפה על המדרגות", imageUrl: null },
  destination: null,
  stats: { likes: 46, comments: 5, saves: 21 },
  likers: [],
  viewerState: { liked: false, saved: true, following: false, isSelf: false },
  nextCursor: null,
};

/** "מפה": בתי קפה בתל אביב כנעצי תמונה - אותם נעצים של מפת places */
const MAP_PINS: JourneyMarker[] = [
  { id: "c1", latitude: 32.0795, longitude: 34.7735, name: "קפה נחמה", color: "#0A6DFE", imageUrl: PREVIEW_IMAGES.mapPins[0] },
  { id: "c2", latitude: 32.0712, longitude: 34.7818, name: "קפה על המדרגות", color: "#0A6DFE", imageUrl: PREVIEW_IMAGES.mapPins[1] },
  { id: "c3", latitude: 32.0638, longitude: 34.7712, name: "בית הקפה בנווה צדק", color: "#0A6DFE", imageUrl: PREVIEW_IMAGES.mapPins[2] },
  { id: "c4", latitude: 32.0868, longitude: 34.7905, name: "קפה בפארק", color: "#0A6DFE", imageUrl: PREVIEW_IMAGES.mapPins[3] },
];

/** מסגרת: הרכיב האמיתי ברוחב של טלפון, מוקטן, בכרטיס לבן - בלי אינטראקציה */
function Frame({ children, height }: { children: ReactNode; height: number }) {
  return (
    <div
      className="cx-preview pointer-events-none relative w-[88%] max-w-[320px] overflow-hidden rounded-[22px] bg-white shadow-[0_24px_50px_-18px_rgba(0,0,0,0.65)]"
      style={{ height, "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties}
      dir="rtl"
    >
      <div style={{ zoom: 0.8 }}>{children}</div>
      <span className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" aria-hidden="true" />
    </div>
  );
}

function MapPreview() {
  return (
    <div className="cx-preview pointer-events-none w-[88%] max-w-[320px] overflow-hidden rounded-[22px] bg-white text-[#0f1419] shadow-[0_24px_50px_-18px_rgba(0,0,0,0.65)]">
      <JourneyMap markers={MAP_PINS} className="h-[250px]" padding={{ top: 40, right: 34, bottom: 30, left: 34 }} />
      <div className="px-4 pb-3.5 pt-3 text-start">
        <p className="text-[15px] font-bold">בתי הקפה הכי שווים בת״א</p>
        <p className="mt-0.5 text-[12.5px] text-[#5b6472]">דניאל אברהם · 4 מקומות</p>
      </div>
    </div>
  );
}

export type CreateModeId = "moment" | "place" | "map";

export function CreateModePreview({ mode }: { mode: CreateModeId }) {
  if (mode === "map") return <MapPreview />;
  const item = mode === "moment" ? POST : REVIEW;
  return (
    <Frame height={330}>
      <PostCard item={item} onLikeToggle={noop} onSaveToggle={noop} onWriteReview={() => {}} onEditPost={noopVoid} onDeletePost={noopVoid} />
    </Frame>
  );
}

/** אנימציית כניסה של הדוגמה - נכנס לעמוד עם ה-CSS שלו */
export const CREATE_PREVIEW_CSS = `
.cx-preview { animation:cx-preview-in .5s cubic-bezier(.2,.8,.2,1) both; }
@keyframes cx-preview-in { from { opacity:0; transform:translateY(16px) scale(.97); } }
@media (prefers-reduced-motion: reduce) { .cx-preview { animation:none !important; } }
`;
