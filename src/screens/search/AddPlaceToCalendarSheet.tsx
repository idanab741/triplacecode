"use client";

import { AddToCalendarSheet } from "@/screens/calendar/AddToCalendarSheet";

interface AddPlaceToCalendarSheetProps {
  placeId: string;
  placeName: string;
  imageUrl: string | null;
  onClose: () => void;
  /** נקרא אחרי הוספה מוצלחת - העמוד הקורא אחראי לנווט לעמוד הבית. */
  onAdded: () => void;
}

/** *** עבר לגיליון האחיד (AddToCalendarSheet) - אותו גיליון בכל האפליקציה, עם שעה והערה. הממשק לא השתנה. */
export function AddPlaceToCalendarSheet({ placeId, placeName, imageUrl, onClose, onAdded }: AddPlaceToCalendarSheetProps) {
  return (
    <AddToCalendarSheet
      item={{ itemType: "place", id: placeId, name: placeName, imageUrl }}
      onClose={onClose}
      onDone={(r) => {
        if (r.action === "added") onAdded();
        else onClose();
      }}
    />
  );
}
