import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import { PlacesMapClient } from "@/screens/places/PlacesMapClient";

/**
 * *** מבנה ניווט חדש (בקשה מפורשת): place's = המפה (לשעבר לשונית "מפה" בפיד).
 * הפיד עצמו עבר לעמוד הבית. קישורים ישנים לפיד (?published=... / ?create=...)
 * מועברים ל-/home עם אותם פרמטרים, כדי שהודעות ההצלחה/תפריט היצירה ימשיכו לעבוד.
 */
export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.published || params.create) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string") qs.set(k, v);
    }
    redirect(`/home?${qs.toString()}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return <PlacesMapClient />;
}
