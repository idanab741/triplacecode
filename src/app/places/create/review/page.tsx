"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { uploadMultipleSocialMedia, type UploadedMedia } from "@/services/social/mediaUploadService";
import { getPlaceCategoryLabel } from "@/constants/placeCategories";

const PURPLE_GRADIENT = "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))";

interface PlacePreview {
  id: string;
  name: string;
  city: string | null;
  category: string;
  image_urls: string[] | null;
}

function ReviewStep() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const placeId = useSearchParams().get("placeId");

  const [place, setPlace] = useState<PlacePreview | null>(null);
  const [placeMissing, setPlaceMissing] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [media, setMedia] = useState<(UploadedMedia & { previewUrl: string })[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!placeId) {
      setPlaceMissing(true);
      return;
    }
    createClient()
      .from("places")
      .select("id,name,city,category,image_urls")
      .eq("id", placeId)
      .maybeSingle()
      .then(({ data }) => (data ? setPlace(data as PlacePreview) : setPlaceMissing(true)));
  }, [placeId]);

  async function handleFilesSelected(files: FileList | null) {
    if (!files || !user) return;
    const selected = Array.from(files).slice(0, 4 - media.length);
    if (selected.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      // מערכת המדיה הקיימת של Reviews - לא ליצור חדשה.
      const uploaded = await uploadMultipleSocialMedia(createClient(), user.id, selected);
      setMedia((prev) => [...prev, ...uploaded.map((m, i) => ({ ...m, previewUrl: URL.createObjectURL(selected[i]) }))]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאת המדיה");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handlePublish() {
    if (!placeId || rating === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/social/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, rating, comment: comment.trim(), mediaIds: media.map((m) => m.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "שגיאה בפרסום הביקורת");
      }
      // חזרה ל-Places Feed - שם מוצגת הודעת ההצלחה והפיד נטען מחדש (הביקורת בראש).
      router.replace("/home?published=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      <HomeStatusBarTint color="#7C3AED" />
      <PlacesHeader variant="purple" onBack={() => router.back()} />

      <div className="px-5 pt-6">
        {placeMissing && <p className="py-10 text-center text-[14px] text-ink-secondary">לא מצאנו את המקום הזה</p>}

        {!place && !placeMissing && <Skeleton className="h-16 w-full" />}

        {place && (
          <>
            {/* Place Preview קטן - בלי לחזור על כל פרטי המקום. */}
            <div className="mb-6 flex items-center gap-3">
              <span className="h-14 w-14 shrink-0 overflow-hidden rounded-card bg-bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {place.image_urls?.[0] && <img src={place.image_urls[0]} alt="" className="h-full w-full object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold text-ink">{place.name}</span>
                <span className="block truncate text-[12.5px] text-ink-secondary">
                  {[place.city, getPlaceCategoryLabel(place.category)].filter(Boolean).join(" · ")}
                </span>
              </span>
            </div>

            <h1 className="mb-3 text-[22px] font-extrabold text-ink">איך היה לכם?</h1>

            <div className="mb-6 flex justify-center gap-2" dir="ltr">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} כוכבים`}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill={star <= rating ? "var(--color-places-purple)" : "none"} stroke="var(--color-places-purple)" strokeWidth="1.5">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>

            <label className="mb-1.5 block text-[14px] font-semibold text-ink">ספרו קצת יותר...</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="מה אהבתם? מה כדאי לדעת לפני שמגיעים?"
              rows={4}
              className="w-full resize-none rounded-card border border-ink-secondary/15 p-3 text-[16px] text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
            />

            {media.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {media.map((m) => (
                  <div key={m.id} className="relative aspect-square overflow-hidden rounded-card bg-bg-secondary">
                    {m.type === "video" ? (
                      <video src={m.previewUrl} className="h-full w-full object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.previewUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => setMedia((prev) => prev.filter((x) => x.id !== m.id))}
                      aria-label="הסר"
                      className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
            <button
              type="button"
              disabled={uploading || media.length >= 4}
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 flex items-center gap-1.5 rounded-pill border px-3.5 py-2 text-[13px] font-semibold disabled:opacity-40"
              style={{ borderColor: "var(--color-places-purple)", color: "var(--color-places-purple)" }}
            >
              <Image src="/images/places-camera-icon.png" alt="" width={16} height={14} className="object-contain" />
              {uploading ? "מעלה..." : "📸 הוסיפו תמונות"}
            </button>

            {error && <p className="mt-3 text-[12.5px] text-red-500">{error}</p>}
          </>
        )}
      </div>

      {place && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-white/95 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 backdrop-blur">
          <button
            type="button"
            disabled={rating === 0 || submitting || uploading}
            onClick={handlePublish}
            className="w-full rounded-pill py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
            style={{ background: PURPLE_GRADIENT }}
          >
            {submitting ? "מפרסמים..." : "פרסום ביקורת"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function CreateReviewStepPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ReviewStep />
    </Suspense>
  );
}
