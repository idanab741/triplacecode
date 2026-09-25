"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui";
import { CheckIcon, PinIcon, PlaneIcon, PlusIcon, RowSkeletons } from "@/screens/create/CreateUi";
import { optimizeImage } from "@/utils/imageUrl";
import type { AddTargetDto, AddTargetsDto } from "@/services/social/addTargetsService";
import { addPlacesToTarget, prepareNewMap, prepareNewTrip, resolveCollectablePlaces, type CollectablePlace } from "./placeTargets";

type RowState = "idle" | "busy" | "added" | "error";

function Thumb({ url, kind }: { url: string | null; kind: "map" | "trip" }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#EFF1F4] text-[#9aa1ad]">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={optimizeImage(url, 96)} alt="" className="h-full w-full object-cover" />
      ) : kind === "trip" ? (
        <PlaneIcon />
      ) : (
        <PinIcon />
      )}
    </span>
  );
}

function countLabel(kind: "map" | "trip", t: AddTargetDto): string {
  if (kind === "map") return t.count === 1 ? "מקום אחד" : `${t.count} מקומות`;
  const stops = t.count === 1 ? "תחנה אחת" : `${t.count} תחנות`;
  return t.days > 1 ? `${stops} · ${t.days} ימים` : stops;
}

/**
 * *** בקשה מפורשת ("להוסיף מקומות למפה / לטיול אחרי שכבר נשמרו"): "הוספה ל..." - כמו "שמירה לאוסף"
 * באינסטגרם / "שמירה לרשימה" ב-Google Maps. רשימת המפות והטיולים שהמשתמש יצר (רק שלו - ההוספה עצמה
 * נאכפת גם בשרת), לחיצה על שורה מוסיפה מיד. בראש: מפה חדשה / טיול חדש עם המקומות כבר בפנים.
 * ids = places.id או מקומות קהילה - מומרים ל-Places אמיתיים לפני ההוספה.
 */
export function AddToSheet({ ids, label, onClose }: { ids: string[]; /** שם המקום, או "3 מקומות" */ label: string; onClose: () => void }) {
  const router = useRouter();
  const [places, setPlaces] = useState<CollectablePlace[] | null>(null);
  const [targets, setTargets] = useState<AddTargetsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [rowError, setRowError] = useState<string | null>(null);

  // מפתח יציב - גם אם ההורה יוצר מערך חדש בכל רינדור, הטעינה רצה רק כשהמזהים משתנים
  const idsKey = ids.join(",");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resolved = await resolveCollectablePlaces(idsKey.split(","));
        if (cancelled) return;
        setPlaces(resolved);
        const res = await fetch(`/api/social/add-targets?placeIds=${resolved.map((p) => p.placeId).join(",")}`);
        const data = (await res.json().catch(() => ({}))) as AddTargetsDto & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "שגיאה בטעינת המפות והטיולים");
        if (!cancelled) setTargets({ maps: data.maps ?? [], trips: data.trips ?? [] });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "משהו השתבש, נסו שוב");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  async function add(kind: "map" | "trip", target: AddTargetDto) {
    const key = `${kind}:${target.id}`;
    if (!places || rows[key] === "busy" || rows[key] === "added") return;
    setRows((r) => ({ ...r, [key]: "busy" }));
    setRowError(null);
    try {
      await addPlacesToTarget(kind, target.id, places.map((p) => p.placeId));
      setRows((r) => ({ ...r, [key]: "added" }));
      navigator.vibrate?.(10);
    } catch (e) {
      setRows((r) => ({ ...r, [key]: "error" }));
      setRowError(e instanceof Error ? e.message : "ההוספה נכשלה, נסו שוב");
    }
  }

  function createNew(kind: "map" | "trip") {
    if (!places) return;
    onClose();
    router.push(kind === "map" ? prepareNewMap(places) : prepareNewTrip(places));
  }

  const section = (kind: "map" | "trip", title: string, list: AddTargetDto[]) =>
    list.length > 0 && (
      <section className="mt-5" aria-label={title}>
        <h3 className="px-1 text-[13px] font-bold text-ink-secondary">{title}</h3>
        <ul className="mt-1.5">
          {list.map((t) => {
            const state = rows[`${kind}:${t.id}`] ?? "idle";
            const already = t.hasAll && state !== "added";
            const done = state === "added";
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => add(kind, t)}
                  disabled={already || done || state === "busy"}
                  aria-label={`${done ? "נוסף ל" : already ? "כבר ב" : "הוספה ל"}${kind === "map" ? "מפה" : "טיול"} ${t.title}`}
                  className="flex w-full items-center gap-3 rounded-[16px] px-2 py-2 text-start transition active:bg-[#F1F2F5] disabled:active:bg-transparent"
                >
                  <Thumb url={t.imageUrl} kind={kind} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-semibold text-ink">{t.title}</span>
                    <span className="block truncate text-[13px] text-ink-secondary">
                      {done && kind === "trip" && t.days > 1 ? `נוסף ליום ${t.days}` : countLabel(kind, t)}
                    </span>
                  </span>
                  {state === "busy" ? (
                    <span className="flex h-8 w-8 items-center justify-center" aria-hidden="true">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#0A6DFE]/25 border-t-[#0A6DFE]" />
                    </span>
                  ) : done ? (
                    <span className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#0A6DFE] px-2.5 text-[12.5px] font-semibold text-white">
                      <CheckIcon size={14} />
                      נוסף
                    </span>
                  ) : already ? (
                    <span className="shrink-0 rounded-full bg-[#F1F2F5] px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-secondary">כבר כאן</span>
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(10,109,254,0.1)", color: "#0A6DFE" }}>
                      <PlusIcon size={18} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );

  const empty = targets && targets.maps.length === 0 && targets.trips.length === 0;

  // נפתח גם מתוך המפה (מכל עם isolate / transform) - לכן מרונדר ישירות ב-body, מעל הכל
  return createPortal(
    <BottomSheet onClose={onClose} zIndex={70}>
      <div className="px-5 pb-3">
        <h2 className="text-[20px] font-bold tracking-tight text-ink">הוספה ל...</h2>
        <p className="mt-0.5 truncate text-[14px] text-ink-secondary">{label}</p>

        {/* מפה / טיול חדשים - עם המקומות כבר בפנים */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["map", "trip"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => createNew(kind)}
              disabled={!places}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-[#F1F2F5] text-[15px] font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
            >
              <PlusIcon size={18} />
              {kind === "map" ? "מפה חדשה" : "טיול חדש"}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-5 rounded-2xl bg-[#FDECEC] px-4 py-3 text-[14px] text-[#C8373C]">{error}</p>
        ) : !targets ? (
          <div className="mt-5">
            <RowSkeletons count={3} />
          </div>
        ) : empty ? (
          <p className="mt-6 text-center text-[14px] text-ink-secondary">עוד אין לכם מפות או טיולים - צרו אחד חדש למעלה.</p>
        ) : (
          <>
            {section("map", "המפות שלי", targets.maps)}
            {section("trip", "הטיולים שלי", targets.trips)}
          </>
        )}
        {rowError && (
          <p className="mt-3 text-[13px] text-[#C8373C]" role="alert">
            {rowError}
          </p>
        )}
      </div>
    </BottomSheet>,
    document.body
  );
}
