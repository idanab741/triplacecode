"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { PlacesHeader } from "@/screens/places/PlacesHeader";
import { useAuth } from "@/hooks/useAuth";

export default function PlacesSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [username, setUsername] = useState<string | null>(null);
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
        setLoaded(true);
      });
  }, [user]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/social/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio, website, profileVisibility: visibility }),
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
