/** טיפוסים משותפים למערכת place's (Social) - סעיפים 61-80 באפיון */

export type ProfileVisibility = "public" | "private";
export type CreatorStatus = "none" | "pending" | "approved" | "rejected" | "suspended";
export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";
export type PostVisibility = "public" | "followers" | "friends" | "private";
export type PostType =
  | "post"
  | "video"
  | "review"
  | "trip"
  | "place_recommendation"
  | "destination_recommendation"
  | "photo";

/** פרופיל social בסיסי - subset של profiles, לשימוש בכרטיסי אנשים/יוצרים ב-Feed/Search */
export interface SocialProfileSummary {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  isCreator: boolean;
  /** מצב הצופה מול המשתמש הזה - מחושב ביחס ל-viewer הנוכחי */
  viewerState: {
    following: boolean;
    friendStatus: FriendshipStatus | "none";
    isSelf: boolean;
  };
}

export interface CreatorProfile {
  userId: string;
  category: string[];
  verificationStatus: "none" | "verified";
  coverMediaUrl: string | null;
  followersCount: number;
}

export interface MediaAsset {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
}
