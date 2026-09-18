"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { searchPlaces, SEARCH_PAGE_SIZE, type PlaceSearchResult, type SearchFilters } from "@/services/places/searchService";
import { Button, Skeleton } from "@/components/ui";
import { SearchResultCard } from "./SearchResultCard";

interface SearchResultsProps {
  filters: SearchFilters;
  onClearFilters: () => void;
}

/** נטען מחדש (state נקי) בכל שינוי סינון, בזכות key={...} בעמוד ההורה. */
export function SearchResults({ filters, onClearFilters }: SearchResultsProps) {
  const [results, setResults] = useState<PlaceSearchResult[] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    searchPlaces(filters, 0).then((data) => {
      setResults(data);
      setHasMore(data.length === SEARCH_PAGE_SIZE);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !results) return;
    setLoadingMore(true);
    const more = await searchPlaces(filters, results.length);
    setResults((prev) => [...(prev ?? []), ...more]);
    setHasMore(more.length === SEARCH_PAGE_SIZE);
    setLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, hasMore, results]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (results === null) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm font-medium text-ink">לא נמצאו תוצאות</p>
        <p className="text-xs text-ink-secondary">נסו לשנות את החיפוש או הסינון</p>
        <Button variant="secondary" onClick={onClearFilters}>
          נקה סינון
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {results.map((place) => (
          <SearchResultCard key={place.id} place={place} />
        ))}
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          <Skeleton className="h-6 w-24" />
        </div>
      )}
    </div>
  );
}
