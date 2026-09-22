"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { resolveUsernameAlias } from "@/services/social/usernameAlias";

/** "פרופיל לא נמצא". אם ה-username הוחלף (כתובת ישנה מההיסטוריה) - מפנים לשם החדש (הכינויים נשמרים ב-localStorage
 *  ע"י עמוד עריכת הפרופיל). לפני ההפניה לא מציגים את ההודעה, כדי שלא תהבהב. */
export default function ProfileNotFound({ username }: { username: string }) {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const renamed = resolveUsernameAlias(username);
    if (renamed) router.replace(`/places/profile/${renamed}`);
    else setShow(true);
  }, [username, router]);

  return show ? <PlacesEmptyState title="פרופיל לא נמצא" /> : null;
}
