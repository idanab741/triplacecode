"use client";

import dynamic from "next/dynamic";
import type { CSSProperties, ReactNode } from "react";
import { PostCard } from "@/screens/places/PostCard";
import { CollectionFeedCard } from "@/screens/collections/CollectionFeedCard";
import type { FeedItemDto } from "@/services/social/feedService";
import type { CollectionCardDto } from "@/services/social/collectionTypes";
import type { JourneyLine, JourneyMarker } from "@/screens/journey/journeyUtils";

const JourneyMap = dynamic(() => import("@/screens/journey/JourneyMap").then((m) => m.JourneyMap), { ssr: false });

/**
 * *** בקשה מפורשת ("הביקורות צריכות להיות כמו בעמודים... המפה כמו המפה ב-places... שייראה מקצועי ורציני"):
 * כל סוג העלאה בעמוד התוכן מציג את **הרכיבים האמיתיים** של האפליקציה עם נתוני דוגמה - אותו PostCard של
 * הפיד (פוסט / ביקורת), אותו CollectionFeedCard (חוויה), ואותה מפה של places (JourneyMap - אותם נעצים). כך
 * הדוגמה תמיד נראית בדיוק כמו התוצאה, וכל שינוי עיצובי בפיד/במפה מתעדכן כאן לבד. רק תצוגה - בלי לחיצות.
 *
 * כל התמונות של הדוגמאות מרוכזות כאן (PREVIEW_IMAGES) - להחלפה בתמונות מעוצבות.
 */
export const PREVIEW_IMAGES = {
  postPhoto: "/images/vacation-destinations/telaviv.png",
  reviewPhoto: "/images/vacation-destinations/haifa.png",
  collection: [
    "/images/vacation-destinations/telaviv.png",
    "/images/vacation-destinations/eilat.png",
    "/images/vacation-destinations/jerusalem.png",
    "/images/vacation-destinations/tiberias.png",
  ],
  tripStops: [
    "/images/vacation-destinations/zafongolan.png",
    "/images/vacation-destinations/tiberias.png",
    "/images/vacation-destinations/haifa.png",
  ],
  avatarPost: null as string | null,
  avatarReview: null as string | null,
  avatarCollection: null as string | null,
};

const NOW = new Date().toISOString();
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
  author: author("preview-a", "נועה לוי", "noa", PREVIEW_IMAGES.avatarPost),
  media: [{ id: "m1", type: "image", url: PREVIEW_IMAGES.postPhoto, thumbnailUrl: null, width: 1200, height: 900 }],
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
  author: author("preview-b", "עומר כהן", "omer", PREVIEW_IMAGES.avatarReview),
  media: [{ id: "m2", type: "image", url: PREVIEW_IMAGES.reviewPhoto, thumbnailUrl: null, width: 1200, height: 900 }],
  place: { id: "preview-place-2", name: "קפה על המדרגות", imageUrl: null },
  destination: null,
  stats: { likes: 46, comments: 5, saves: 21 },
  likers: [],
  viewerState: { liked: false, saved: true, following: false, isSelf: false },
  nextCursor: null,
};

const COLLECTION: CollectionCardDto = {
  id: "preview-collection",
  type: "places",
  title: "בתי הקפה הכי שווים בת״א",
  description: null,
  createdAt: NOW,
  visibility: "public",
  author: author("preview-c", "דניאל אברהם", "daniel", PREVIEW_IMAGES.avatarCollection),
  itemCount: 8,
  coverUrl: null,
  collageUrls: PREVIEW_IMAGES.collection,
  stats: { likes: 214, comments: 18 },
  viewerState: { liked: false, saved: false, isSelf: false },
};

const TRIP_MARKERS: JourneyMarker[] = [
  { id: "s1", latitude: 33.0, longitude: 35.77, name: "תצפית הגולן", label: "1", color: "#0A6DFE", imageUrl: PREVIEW_IMAGES.tripStops[0] },
  { id: "s2", latitude: 32.795, longitude: 35.53, name: "טיילת טבריה", label: "2", color: "#0A6DFE", imageUrl: PREVIEW_IMAGES.tripStops[1] },
  { id: "s3", latitude: 32.814, longitude: 34.99, name: "המושבה הגרמנית", label: "1", color: "#E0701A", imageUrl: PREVIEW_IMAGES.tripStops[2] },
];
const TRIP_LINES: JourneyLine[] = [
  { id: "d1", color: "#0A6DFE", points: TRIP_MARKERS.slice(0, 2) },
  { id: "d2", color: "#E0701A", dashed: true, points: [TRIP_MARKERS[1], TRIP_MARKERS[2]] },
];

/** מסגרת: הרכיב האמיתי ברוחב של טלפון, מוקטן, בכרטיס לבן - בלי אינטראקציה */
function Frame({ children, height }: { children: ReactNode; height: number }) {
  return (
    <div
      className="cx-preview pointer-events-none relative w-[86%] max-w-[300px] overflow-hidden rounded-[22px] bg-white shadow-[0_24px_50px_-18px_rgba(0,0,0,0.65)]"
      style={{ height, "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties}
      dir="rtl"
    >
      <div style={{ zoom: 0.8 }}>{children}</div>
      <span className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" aria-hidden="true" />
    </div>
  );
}

function TripPreview() {
  return (
    <div className="cx-preview pointer-events-none w-[86%] max-w-[300px] overflow-hidden rounded-[22px] bg-white text-[#0f1419] shadow-[0_24px_50px_-18px_rgba(0,0,0,0.65)]">
      <JourneyMap markers={TRIP_MARKERS} lines={TRIP_LINES} className="h-[210px]" padding={{ top: 36, right: 28, bottom: 24, left: 28 }} />
      <div className="px-4 pb-3.5 pt-3 text-start">
        <p className="text-[15px] font-bold">סופ״ש בצפון</p>
        <p className="mt-0.5 text-[12.5px] text-[#5b6472]">3 תחנות · 2 ימים</p>
      </div>
    </div>
  );
}

export type CreateModeId = "post" | "place" | "collection" | "trip";

export function CreateModePreview({ mode }: { mode: CreateModeId }) {
  if (mode === "trip") return <TripPreview />;
  if (mode === "collection")
    return (
      <Frame height={300}>
        <CollectionFeedCard item={COLLECTION} />
      </Frame>
    );
  const item = mode === "post" ? POST : REVIEW;
  return (
    <Frame height={300}>
      <PostCard item={item} onLikeToggle={noop} onSaveToggle={noop} onWriteReview={() => {}} onEditPost={noopVoid} onDeletePost={noopVoid} />
    </Frame>
  );
}

/** אנימציית כניסה של הדוגמה - נכנס לעמוד עם ה-CSS שלו */
export const CREATE_PREVIEW_CSS = `
.cx-preview { animation:cx-preview-in .5s cubic-bezier(.2,.8,.2,1) both; }
@keyframes cx-preview-in { from { opacity:0; transform:translateY(20px) scale(.95); } }
@media (prefers-reduced-motion: reduce) { .cx-preview { animation:none !important; } }
`;
