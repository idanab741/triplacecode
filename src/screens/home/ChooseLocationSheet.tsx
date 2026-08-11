"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { BottomSheet } from "@/components/ui";
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

/** אייקון מיקום אחיד - קו (stroke), לא אימוג'י - תואם לסגנון האייקונים
 *  האחרים באפליקציה (כמו המחיקה/ברירת המחדל ב-AddressRow). */
function PinIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 21s-7-6.2-7-11.2A7 7 0 0 1 19 9.8C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </svg>
  );
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

  const [allCitiesOpen, setAllCitiesOpen] = useState(false);
  const [allCities, setAllCities] = useState<{ name: string; country: string }[]>([]);
  const [allCitiesLoading, setAllCitiesLoading] = useState(false);

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

  /** *** תיקון: לפני זה "השתמש במיקום הנוכחי שלי" שמר כתובת חדשה בכל
   *  לחיצה - לחיצות חוזרות יצרו כמה שורות "מיקום נוכחי" כפולות ברשימה
   *  (בדיוק מה שנראה כ"2 כפתורי מיקום"). עכשיו זה תמיד ephemeral בלבד -
   *  כפתור אחד שמתעדכן לפי המיקום האמיתי, לא נשמר כערך קבוע ברשימה. */
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

          onSelect({
            id: "current",
            user_id: user?.id ?? "",
            label: data.address_text,
            address_text: data.address_text,
            city: data.city,
            latitude,
            longitude,
            is_default: false,
            created_at: new Date().toISOString(),
          });
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
          // *** תיקון: להשתמש ב-label הקצר שחזר מ-address-details, לא
          // ב-prediction.description הארוך של גוגל (כולל "ישראל" בסוף).
          label: data.address_text,
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

  /** *** תיקון: זה היה alert("בקרוב") בלבד - עכשיו שולף בפועל את 221
   *  היעדים מ-destinations (אותה רשימה שכבר בשימוש ב-TripMatch). */
  function handleOpenAllCities() {
    setAllCitiesOpen(true);
    if (allCities.length > 0) return;
    setAllCitiesLoading(true);
    fetch("/api/places/cities/all")
      .then((res) => res.json())
      .then((data) => setAllCities(data.cities ?? []))
      .catch(() => setAllCities([]))
      .finally(() => setAllCitiesLoading(false));
  }

  function handlePickCity(city: { name: string; country: string }) {
    onSelect({
      id: `city-${city.name}`,
      user_id: user?.id ?? "",
      label: city.name,
      address_text: city.name,
      city: city.name,
      latitude: null,
      longitude: null,
      is_default: false,
      created_at: new Date().toISOString(),
    });
    setAllCitiesOpen(false);
  }

  return (
    <>
      <BottomSheet onClose={onClose}>
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
            {/* *** תיקון: לפני זה בלי שום הגבלת גובה - רשימה ארוכה נחתכה
                ע"י גבולות ה-sheet. עכשיו גובה קבוע (כ-2 שורות) עם גלילה
                פנימית, אותה תבנית שכבר תוקנה במקומות אחרים באפליקציה. */}
            <div className="flex max-h-28 flex-col overflow-y-auto overscroll-contain">
              {predictions.map((p) => (
                <button
                  key={p.placeId}
                  type="button"
                  onClick={() => handlePickPrediction(p)}
                  className="flex items-center gap-2 border-b border-ink-secondary/10 py-3 text-start text-sm text-ink last:border-none"
                >
                  <PinIcon className="shrink-0 text-ink-secondary" />
                  {p.description}
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
              >
                <PinIcon />
              </span>
              <span className="text-[15px] font-semibold text-ink">
                {usingCurrentLocation ? "מאתר את המיקום שלך..." : "השתמש במיקום הנוכחי שלי"}
              </span>
            </button>

            {loading ? (
              <div className="admin-skeleton mx-5 h-16 rounded-card" />
            ) : (
              // *** תיקון: "רק 3 בנוסף למיקום הנוכחי" - לפני זה כל הכתובות
              // השמורות הוצגו בלי הגבלה.
              addresses.slice(0, 3).map((address) => (
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
              onClick={handleOpenAllCities}
              className="flex items-center gap-3 border-t border-ink-secondary/10 px-5 py-3.5 text-start"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg-secondary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 20l-6 2V6l6-2 6 2 6-2v16l-6 2-6-2z" />
                  <path d="M9 4v16M15 6v16" />
                </svg>
              </span>
              <span className="text-[15px] font-semibold text-ink">כל הערים שבהן יש Triplace</span>
            </button>

            <div className="px-5 pt-4">
              <button
                type="button"
                onClick={() => setAddingAddress(true)}
                className="w-full rounded-pill px-6 py-2 text-sm font-semibold text-white shadow-soft"
                style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
              >
                + הוספת כתובת
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {allCitiesOpen && (
        <BottomSheet onClose={() => setAllCitiesOpen(false)} zIndex={70}>
          <div className="flex items-center justify-between px-5 pt-4">
            <button type="button" onClick={() => setAllCitiesOpen(false)} aria-label="סגירה" className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-soft">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <h2 className="text-lg font-bold text-ink">כל הערים שבהן יש Triplace</h2>
            <div className="w-9" />
          </div>
          <div className="flex flex-col pt-3">
            {allCitiesLoading ? (
              <div className="admin-skeleton mx-5 h-16 rounded-card" />
            ) : (
              allCities.map((city) => (
                <button
                  key={`${city.name}-${city.country}`}
                  type="button"
                  onClick={() => handlePickCity(city)}
                  className="flex items-center gap-3 border-b border-ink-secondary/10 px-5 py-3 text-start"
                >
                  <PinIcon className="shrink-0 text-ink-secondary" />
                  <span>
                    <span className="block text-[15px] font-semibold text-ink">{city.name}</span>
                    <span className="block text-[12.5px] text-ink-secondary">{city.country}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
