"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import {
  listAddresses,
  addAddress,
  setDefaultAddress,
  deleteAddress,
  type UserAddress,
} from "@/services/addresses/addressesService";
import { AddressRow } from "./AddressRow";

interface ChooseLocationSheetProps {
  onClose: () => void;
  onSelect: (address: UserAddress) => void;
}

interface AddressPrediction {
  placeId: string;
  description: string;
}

/** Bottom Sheet לבחירת מיקום - בהשראת התבנית של Wolt (מיקום נוכחי, כתובות
 *  שמורות, הוספת כתובת), בנוי כולו עם ה-Design Tokens הקיימים של
 *  Triplace - בלי צבעים/גופנים/רכיבים חדשים. */
export function ChooseLocationSheet({ onClose, onSelect }: ChooseLocationSheetProps) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);

  const [addingAddress, setAddingAddress] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [savingAddress, setSavingAddress] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    listAddresses(supabase, user.id)
      .then(setAddresses)
      .catch(() => setError("לא הצלחנו לטעון את הכתובות השמורות"))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (addressQuery.trim().length < 3) {
      setPredictions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/places/address-autocomplete?q=${encodeURIComponent(addressQuery.trim())}`)
        .then((res) => res.json())
        .then((data) => setPredictions(data.predictions ?? []))
        .catch(() => setPredictions([]));
    }, 300);
  }, [addressQuery]);

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setError("הדפדפן שלך לא תומך באיתור מיקום");
      return;
    }
    setUsingCurrentLocation(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/places/reverse-geocode?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          if (user) {
            const supabase = createClient();
            const saved = await addAddress(supabase, user.id, {
              label: data.address_text,
              address_text: data.address_text,
              city: data.city,
              latitude,
              longitude,
              is_default: true,
            });
            onSelect(saved);
          } else {
            onSelect({
              id: "current",
              user_id: "",
              label: data.address_text,
              address_text: data.address_text,
              city: data.city,
              latitude,
              longitude,
              is_default: true,
              created_at: new Date().toISOString(),
            });
          }
        } catch {
          setError("לא הצלחנו לזהות את המיקום שלך. נסו שוב.");
        } finally {
          setUsingCurrentLocation(false);
        }
      },
      () => {
        setError("יש לאשר גישה למיקום כדי להשתמש באפשרות הזו");
        setUsingCurrentLocation(false);
      }
    );
  }

  async function handlePickPrediction(prediction: AddressPrediction) {
    setSavingAddress(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/address-details?placeId=${prediction.placeId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (user) {
        const supabase = createClient();
        const saved = await addAddress(supabase, user.id, {
          label: prediction.description,
          address_text: data.address_text,
          city: data.city,
          latitude: data.latitude,
          longitude: data.longitude,
        });
        setAddresses((prev) => [saved, ...prev]);
      }
      setAddingAddress(false);
      setAddressQuery("");
      setPredictions([]);
    } catch {
      setError("לא הצלחנו לשמור את הכתובת. נסו שוב.");
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleSetDefault(address: UserAddress) {
    if (!user) return;
    setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === address.id })));
    try {
      const supabase = createClient();
      await setDefaultAddress(supabase, user.id, address.id);
    } catch {
      setError("לא הצלחנו לעדכן את הכתובת הראשית");
    }
  }

  async function handleDelete(address: UserAddress) {
    if (!confirm(`להסיר את "${address.label}"?`)) return;
    setAddresses((prev) => prev.filter((a) => a.id !== address.id));
    try {
      const supabase = createClient();
      await deleteAddress(supabase, address.id);
    } catch {
      setError("לא הצלחנו למחוק את הכתובת");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-card bg-bg pb-24"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-pill bg-ink-secondary/30" />

        <div className="flex items-center justify-between px-5 pt-4">
          <button type="button" onClick={onClose} aria-label="סגירה" className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-soft">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-ink">{addingAddress ? "הוספת כתובת" : "בחרו את המיקום שלכם"}</h2>
          <div className="w-9" />
        </div>

        {error && <p className="mt-3 px-5 text-center text-[13px] text-danger">{error}</p>}

        {addingAddress ? (
          <div className="flex flex-col gap-3 px-5 pt-5">
            <input
              autoFocus
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.target.value)}
              placeholder="חפשו רחוב ומספר בית..."
              className="w-full rounded-card border border-ink-secondary/25 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            {savingAddress && <p className="text-center text-sm text-ink-secondary">שומר...</p>}
            <div className="flex flex-col">
              {predictions.map((p) => (
                <button
                  key={p.placeId}
                  type="button"
                  onClick={() => handlePickPrediction(p)}
                  className="border-b border-ink-secondary/10 py-3 text-start text-sm text-ink last:border-none"
                >
                  📍 {p.description}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setAddingAddress(false)} className="pt-2 text-center text-sm font-semibold text-accent">
              ביטול
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1 pt-3">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={usingCurrentLocation}
              className="flex items-center gap-3 px-5 py-3.5 text-start disabled:opacity-60"
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-white"
                style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
              >
                📍
              </span>
              <span className="text-[15px] font-semibold text-ink">
                {usingCurrentLocation ? "מאתר את המיקום שלך..." : "השתמש במיקום הנוכחי שלי"}
              </span>
            </button>

            {loading ? (
              <div className="admin-skeleton mx-5 h-16 rounded-card" />
            ) : (
              addresses.map((address) => (
                <AddressRow
                  key={address.id}
                  address={address}
                  onSelect={() => onSelect(address)}
                  onSetDefault={() => handleSetDefault(address)}
                  onDelete={() => handleDelete(address)}
                />
              ))
            )}

            {!user && !loading && (
              <p className="px-5 py-3 text-center text-[13px] text-ink-secondary">
                יש להתחבר כדי לשמור כתובות לפעם הבאה.
              </p>
            )}

            <button
              type="button"
              onClick={() => alert("בקרוב - עיון בכל הערים שבהן זמין Triplace")}
              className="flex items-center gap-3 border-t border-ink-secondary/10 px-5 py-3.5 text-start"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-lg">🗺️</span>
              <span className="text-[15px] font-semibold text-ink">כל הערים שבהן יש Triplace</span>
            </button>

            <div className="px-5 pt-4">
              <button
                type="button"
                onClick={() => setAddingAddress(true)}
                className="w-full rounded-pill px-6 py-4 text-base font-bold text-white shadow-soft"
                style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
              >
                + הוספת כתובת
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
