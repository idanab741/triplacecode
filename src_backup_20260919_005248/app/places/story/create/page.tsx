"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { uploadSocialMedia, type UploadedMedia } from "@/services/social/mediaUploadService";
import { BackButton } from "@/components/ui";

const BACKGROUNDS = [
  "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))",
  "linear-gradient(135deg, #ff9a8b, #ff6a88)",
  "linear-gradient(135deg, #43cea2, #185a9d)",
  "linear-gradient(135deg, #232526, #414345)",
];

interface Transform {
  x: number;
  y: number;
  scale: number;
}

/** יצירת Story: תמונה/וידאו (מהגלריה או ישירות מהמצלמה) באיכות מקורית -
 *  ללא כל דחיסה/שינוי גודל בצד הלקוח, מה שמעלים ב-uploadSocialMedia הוא
 *  בדיוק הקובץ המקורי מהמצלמה/גלריה. גרירה + צביטה (pinch) להגדלה/הקטנה
 *  של התמונה, וטקסט חופשי שניתן לגרור בנפרד. */
export default function CreateStoryPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [media, setMedia] = useState<(UploadedMedia & { previewUrl: string }) | null>(null);
  const [uploading, setUploading] = useState(false);
  const [text, setText] = useState("");
  const [editingText, setEditingText] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [imgTransform, setImgTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [textTransform, setTextTransform] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const imgPointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const imgDragStart = useRef<{ x: number; y: number } | null>(null);
  const imgPinchStart = useRef<{ distance: number; scale: number } | null>(null);

  function handleImgPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    imgPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (imgPointers.current.size === 1) {
      imgDragStart.current = { x: e.clientX - imgTransform.x, y: e.clientY - imgTransform.y };
    } else if (imgPointers.current.size === 2) {
      const pts = Array.from(imgPointers.current.values());
      const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      imgPinchStart.current = { distance, scale: imgTransform.scale };
    }
  }

  function handleImgPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!imgPointers.current.has(e.pointerId)) return;
    imgPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pinchStart = imgPinchStart.current;
    const dragStart = imgDragStart.current;

    if (imgPointers.current.size === 2 && pinchStart) {
      const pts = Array.from(imgPointers.current.values());
      const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const nextScale = Math.min(4, Math.max(1, pinchStart.scale * (distance / pinchStart.distance)));
      setImgTransform((prev) => ({ ...prev, scale: nextScale }));
    } else if (imgPointers.current.size === 1 && dragStart) {
      const nextX = e.clientX - dragStart.x;
      const nextY = e.clientY - dragStart.y;
      setImgTransform((prev) => ({ ...prev, x: nextX, y: nextY }));
    }
  }

  function handleImgPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    imgPointers.current.delete(e.pointerId);
    if (imgPointers.current.size === 1) {
      const [remaining] = Array.from(imgPointers.current.values());
      imgDragStart.current = { x: remaining.x - imgTransform.x, y: remaining.y - imgTransform.y };
    } else if (imgPointers.current.size === 0) {
      imgDragStart.current = null;
      imgPinchStart.current = null;
    }
  }

  const textDragStart = useRef<{ x: number; y: number } | null>(null);

  function handleTextPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    textDragStart.current = { x: e.clientX - textTransform.x, y: e.clientY - textTransform.y };
  }

  function handleTextPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const start = textDragStart.current;
    if (!start) return;
    setTextTransform({ x: e.clientX - start.x, y: e.clientY - start.y });
  }

  function handleTextPointerUp() {
    textDragStart.current = null;
  }

  async function handleMediaSelected(file: File | undefined) {
    if (!file || !user) return;
    setUploading(true);
    setError(null);
    try {
      // מעלה את הקובץ המקורי כמו שהוא - בלי שום דחיסה/resize בצד הלקוח,
      // כדי לא לפגוע באיכות (בקשה מפורשת).
      const supabase = createClient();
      const uploaded = await uploadSocialMedia(supabase, user.id, file);
      setMedia({ ...uploaded, previewUrl: URL.createObjectURL(file) });
      setImgTransform({ x: 0, y: 0, scale: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאת המדיה");
    } finally {
      setUploading(false);
    }
  }

  async function handlePublish() {
    if (!text.trim() && !media) {
      setError("כתוב משהו או הוסף תמונה/וידאו לפני שמפרסמים");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/social/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          visibility: "public",
          mediaIds: media ? [media.id] : undefined,
        }),
      });
      if (!res.ok) throw new Error("שגיאה בפרסום הסטורי");
      router.replace("/places");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSubmitting(false);
    }
  }

  const hasMedia = !!media;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden" style={!hasMedia ? { background: BACKGROUNDS[bgIndex] } : { background: "#000" }}>
      {/* אותו BackButton המשותף בדיוק כמו כל שאר האפליקציה (לא אייקון
          מאולתר) - עטוף בעיגול רקע חצי-שקוף כדי שיהיה קריא גם מעל
          תמונה/רקע צבעוני. */}
      <div className="absolute left-5 top-4 z-30">
        <span className="inline-flex rounded-full bg-white/90">
          <BackButton onBack={() => router.back()} />
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {hasMedia ? (
          media.type === "video" ? (
            <video src={media.previewUrl} className="h-full w-full object-cover" controls muted />
          ) : (
            <div
              className="h-full w-full touch-none"
              onPointerDown={handleImgPointerDown}
              onPointerMove={handleImgPointerMove}
              onPointerUp={handleImgPointerUp}
              onPointerCancel={handleImgPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.previewUrl}
                alt=""
                draggable={false}
                className="h-full w-full select-none object-cover"
                style={{
                  transform: `translate(${imgTransform.x}px, ${imgTransform.y}px) scale(${imgTransform.scale})`,
                  transformOrigin: "center",
                }}
              />
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center px-6">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="מה קורה?"
              rows={4}
              className="w-full resize-none bg-transparent text-center text-[24px] font-bold text-white placeholder:text-white/70 focus:outline-none"
            />
          </div>
        )}

        {hasMedia && (text || editingText) && (
          <div
            className="absolute left-1/2 top-1/2 z-20 max-w-[85%] cursor-move touch-none select-none"
            style={{ transform: `translate(-50%, -50%) translate(${textTransform.x}px, ${textTransform.y}px)` }}
            onPointerDown={handleTextPointerDown}
            onPointerMove={handleTextPointerMove}
            onPointerUp={handleTextPointerUp}
            onPointerCancel={handleTextPointerUp}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => setEditingText(false)}
              placeholder="הוסף טקסט..."
              rows={2}
              className="resize-none bg-transparent text-center text-[22px] font-bold text-white placeholder:text-white/70 focus:outline-none"
              style={{ textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
            />
          </div>
        )}

        {hasMedia && !text && !editingText && (
          <button
            type="button"
            onClick={() => setEditingText(true)}
            className="absolute bottom-24 start-4 z-20 flex items-center gap-1.5 rounded-pill bg-black/40 px-3 py-1.5 text-[12.5px] font-semibold text-white"
          >
            🅰️ הוסף טקסט
          </button>
        )}
      </div>

      {error && <p className="relative z-20 px-6 pb-2 text-center text-[12.5px] text-white">{error}</p>}

      {!hasMedia && (
        <div className="relative z-20 flex items-center justify-center gap-4 pb-4">
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => handleMediaSelected(e.target.files?.[0])}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleMediaSelected(e.target.files?.[0])}
          />
          <ToolButton label="צלם" iconSrc="/images/places-camera-icon.png" onClick={() => cameraInputRef.current?.click()} />
          <ToolButton label="גלריה" iconSrc="/images/places-gallery-icon.png" onClick={() => galleryInputRef.current?.click()} />
        </div>
      )}

      {!hasMedia && (
        <div className="relative z-20 flex flex-col items-center gap-2 pb-6">
          <span className="text-[11.5px] font-semibold text-white/80">רקע</span>
          <div className="flex justify-center gap-3">
            {BACKGROUNDS.map((bg, i) => (
              <button
                key={bg}
                type="button"
                onClick={() => setBgIndex(i)}
                aria-label={`רקע ${i + 1}`}
                className="h-9 w-9 rounded-full border-2"
                style={{ background: bg, borderColor: i === bgIndex ? "white" : "transparent" }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="relative z-30 flex justify-center pb-6">
        <button
          type="button"
          onClick={handlePublish}
          disabled={submitting || uploading}
          className="rounded-pill bg-white px-8 py-3 text-[14px] font-bold text-ink shadow-lg disabled:opacity-50"
        >
          {submitting ? "מפרסם..." : "פרסם"}
        </button>
      </div>

      {uploading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50">
          <p className="text-[13px] font-semibold text-white">מעלה באיכות מקורית...</p>
        </div>
      )}
    </div>
  );
}

function ToolButton({ label, icon, iconSrc, onClick }: { label: string; icon?: string; iconSrc?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-lg">
        {iconSrc ? <Image src={iconSrc} alt="" width={20} height={18} className="object-contain" /> : icon}
      </span>
      <span className="text-[10.5px] font-semibold text-ink">{label}</span>
    </button>
  );
}
