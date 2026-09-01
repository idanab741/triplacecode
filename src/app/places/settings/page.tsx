"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { AvatarUploader } from "@/components/AvatarUploader";
import { uploadSocialMedia } from "@/services/social/mediaUploadService";
import { createClient } from "@/services/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function PlacesSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch("/api/social/profile/me")
      .then((r) => r.json())
      .then((data) => {
        setBio(data.profile?.bio ?? "");
        setWebsite(data.profile?.website ?? "");
        setVisibility(data.profile?.profile_visibility ?? "public");
        setUsername(data.profile?.username ?? null);
        setAvatarUrl(data.profile?.avatar_url ?? null);
        setCoverUrl(data.profile?.cover_url ?? null);
        setLoaded(true);
      });
  }, [user]);

  async function handleCoverFileChange(file: File | undefined) {
    if (!file || !user) return;
    setUploadingCover(true);
    setCoverError(null);
    try {
      const supabase = createClient();
      const uploaded = await uploadSocialMedia(supabase, user.id, file);
      setCoverUrl(uploaded.url);
    } catch {
      setCoverError("העלאת תמונת הקאבר נכשלה, נסו שוב");
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/social/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio, website, profileVisibility: visibility, coverUrl }),
      });
      if (username) router.replace(`/places/profile/${username}`);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="min-h-screen bg-white pb-10">
      <PlacesHeader onBack={() => router.back()} />

      <div className="relative h-28 w-full bg-bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {coverUrl && <img src={coverUrl} alt="" className="h-full w-full object-cover" />}
        <label className="absolute bottom-2 end-2 flex cursor-pointer items-center gap-1.5 rounded-pill bg-black/50 px-3 py-1.5 text-[11.5px] font-semibold text-white">
          {uploadingCover ? "מעלה..." : "החלף קאבר"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploadingCover}
            onChange={(e) => handleCoverFileChange(e.target.files?.[0])}
          />
        </label>
      </div>
      {coverError && <p className="px-4 pt-1 text-[12px] text-red-500">{coverError}</p>}

      <div className="-mt-10 flex justify-center">
        {user && (
          <div className="h-[88px] w-[88px] overflow-hidden rounded-full border-4 border-white shadow-soft">
            <AvatarUploader userId={user.id} initialUrl={avatarUrl} onUploaded={setAvatarUrl} fluid bordered={false} />
          </div>
        )}
      </div>

      <div className="px-4">
        <div className="mt-4 flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-ink-secondary">קצת עליי</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-card border border-ink-secondary/15 p-3 text-[13.5px] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-ink-secondary">אתר</label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} dir="ltr" placeholder="https://" />
        </div>

        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-ink-secondary">פרטיות הפרופיל</label>
          <div className="flex gap-2">
            {(["public", "private"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className="rounded-pill px-4 py-1.5 text-[12.5px] font-semibold"
                style={
                  visibility === v
                    ? { background: "var(--color-places-purple)", color: "white" }
                    : { background: "var(--color-bg-secondary, #f2f2f5)", color: "var(--color-ink-secondary, #8a94a6)" }
                }
              >
                {v === "public" ? "ציבורי" : "פרטי"}
              </button>
            ))}
          </div>
        </div>

        <Button fullWidth disabled={saving} onClick={handleSave}>
          {saving ? "שומר..." : "שמור"}
        </Button>
        </div>
      </div>
    </div>
  );
}
