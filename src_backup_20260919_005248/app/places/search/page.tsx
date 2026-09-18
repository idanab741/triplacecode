"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { PlacesEmptyState } from "@/screens/places/PlacesEmptyState";
import { getAvatarUrl } from "@/constants/avatar";

interface PersonResult {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
}

export default function PlacesSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonResult[] | null>(null);
  const [creators, setCreators] = useState<PersonResult[] | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setPeople(null);
      setCreators(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/social/search?q=${encodeURIComponent(term)}`)
        .then((r) => r.json())
        .then((data) => {
          setPeople(data.people ?? []);
          setCreators(data.creators ?? []);
        })
        .catch(() => {
          setPeople([]);
          setCreators([]);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const merged = [...(creators ?? []), ...(people ?? []).filter((p) => !creators?.some((c) => c.id === p.id))];

  return (
    <div className="min-h-screen bg-white">
      <PlacesHeader onBack={() => router.back()} />

      <div className="px-4 py-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חפש אנשים, יוצרים..."
          className="w-full rounded-pill border border-ink-secondary/20 px-4 py-2.5 text-[14px] focus:outline-none"
          style={{ borderColor: query ? "var(--color-places-purple)" : undefined }}
        />
      </div>

      {query.trim().length < 2 && <PlacesEmptyState title="הקלד לפחות 2 תווים כדי לחפש" />}

      {query.trim().length >= 2 && people === null && (
        <div className="px-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="mb-2 h-14 w-full" />
          ))}
        </div>
      )}

      {query.trim().length >= 2 && people !== null && merged.length === 0 && (
        <PlacesEmptyState title="לא נמצאו תוצאות" />
      )}

      {merged.length > 0 && (
        <ul>
          {merged.map((person) => (
            <li key={person.id}>
              <Link
                href={`/places/profile/${person.username ?? person.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-bg-secondary"
              >
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getAvatarUrl(person.avatar_url)} alt="" className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-[14px] font-bold text-ink">{person.full_name ?? person.username}</span>
                    {person.is_creator && <span style={{ color: "var(--color-places-purple)" }}>✓</span>}
                  </span>
                  {person.username && <span className="block text-[12px] text-ink-secondary">@{person.username}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
