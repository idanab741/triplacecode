"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { getFavoritePlaces, type FavoriteStatus } from "@/services/favorites/favoritesService";
import type { UnifiedPlace } from "@/services/places/unifiedPlaceService";
import { Skeleton } from "@/components/ui";

/** "היעדים שלי" - יעדים אמיתיים שהמשתמש שמר/אהב (favorites הקיים,
 *  place_type='destination'), לא placeholder גנרי. מוצג בעמוד הבית של
 *  place's כדי לתת לו זהות אישית ולא סתם Feed גנרי (בקשה מפורשת #9). */
export function MyDestinationsSection() {
  const { user } = useAuth();
  const [destinations, setDestinations] = useState<UnifiedPlace[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all(
      (["saved", "liked"] as FavoriteStatus[]).map((status) => getFavoritePlaces(user.id, status))
    )
      .then(([saved, liked]) => {
        const merged = [...saved, ...liked].filter((p) => p.type === "destination");
        const unique = Array.from(new Map(merged.map((d) => [d.id, d])).values());
        setDestinations(unique.slice(0, 10));
      })
      .catch(() => setDestinations([]));
  }, [user]);

  if (destinations === null) {
    return (
      <div className="px-4 py-3">
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-40 shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (destinations.length === 0) return null;

  return (
    <section className="px-4 py-3">
      <h2 className="mb-3 text-[15px] font-bold text-ink">היעדים שלי</h2>
      <div className="flex gap-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {destinations.map((dest) => (
          <Link
            key={dest.id}
            href={`/destination/${dest.id}`}
            className="relative h-28 w-40 shrink-0 overflow-hidden rounded-card"
          >
            {dest.imageUrls[0] ? (
              <Image src={dest.imageUrls[0]} alt="" fill className="object-cover" />
            ) : (
              <div className="h-full w-full" style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-2.5">
              <p className="truncate text-[13px] font-bold text-white">{dest.name}</p>
              {dest.country && <p className="truncate text-[10.5px] text-white/80">{dest.country}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
