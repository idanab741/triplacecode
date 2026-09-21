/** תוכן של משתמש בעמוד הפרופיל: פוסטים, ביקורות, אוספים וטיולים - כולם כ"אריחים" (Grid) באותו סגנון. */

export type ProfileTileKind = "post" | "review" | "collection" | "trip";
export type ProfileContentFilter = "all" | ProfileTileKind;

export const PROFILE_CONTENT_FILTERS: ProfileContentFilter[] = ["all", "post", "review", "collection", "trip"];

export interface ProfileTileDto {
  /** מזהה ייחודי בין הסוגים: `${kind}:${id}` */
  key: string;
  id: string;
  kind: ProfileTileKind;
  href: string;
  createdAt: string;
  /** תמונת האריח (מדיה קיימת בלבד). null = אריח טקסט. */
  imageUrl: string | null;
  isVideo: boolean;
  /** כותרת בתחתית האריח: שם המקום (ביקורת/פוסט על מקום), כותרת האוסף/הטיול. */
  title: string | null;
  /** טקסט הפוסט (לאריח בלי תמונה). */
  text: string | null;
  /** דירוג - רק לביקורות. */
  rating: number | null;
}
