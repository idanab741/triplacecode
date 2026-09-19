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

function PinIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 21s-7-6.2-7-11.2A7 7 0 0 1 19 9.8C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/**
 * *** בקשה מפורשת ("למה הוא לא מוסיף שורה אחרי שלחצתי על המיקום שלי?
 * הוא יכול להוסיף עד 2 להיסטוריית המיקומים"): "מיקום נוכחי" ובחירת
 * עיר מהרשימה מחזירים UserAddress *זמני* שלא נשמר בשום מקום (רק כתובת
 * שנוספה דרך "הוספת כתובת" נשמרת ב-user_addresses) - לכן אחרי הבחירה
 * לא הופיעה שום שורה. עכשיו כל בחירה כזו נזכרת בהיסטוריית "מיקומים
 * אחרונים": עד 2, החדש ראשון, בלי כפילויות. נשמר ב-localStorage של
 * המכשיר בלבד (לפי משתמש) - בלי שינוי סכמה/מיגרציה ב-DB.
 */
const RECENT_LOCATIONS_KEY = "triplace_recent_locations_v1";
const MAX_RECENT_LOCATIONS = 2;

function recentStorageKey(userId: string | undefined) {
  return `${RECENT_LOCATIONS_KEY}:${userId ?? "guest"}`;
}

function locationKey(address: UserAddress): string {
  return (address.city || address.label || "").trim().toLowerCase();
}

function readRecentLocations(userId: string | undefined): UserAddress[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(recentStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as UserAddress[]).slice(0, MAX_RECENT_LOCATIONS) : [];
  } catch {
    return [];
  }
}

function rememberLocation(userId: string | undefined, address: UserAddress): UserAddress[] {
  const key = locationKey(address);
  const existing = readRecentLocations(userId);
  if (!key) return existing;
  const next = [address, ...existing.filter((a) => locationKey(a) !== key)].slice(0, MAX_RECENT_LOCATIONS);
  try {
    window.localStorage.setItem(recentStorageKey(userId), JSON.stringify(next));
  } catch {
    // localStorage לא זמין (מצב פרטי וכו') - לא קריטי, פשוט לא יישמר בין טעינות.
  }
  return next;
}

type View = "main" | "addAddress" | "allCities";

export function ChooseLocationSheet({ onClose, onSelect }: ChooseLocationSheetProps) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [recentLocations, setRecentLocations] = useState<UserAddress[]>([]);

  useEffect(() => {
    setRecentLocations(readRecentLocations(user?.id));
  }, [user?.id]);

  /** בחירת מיקום *זמני* (נוכחי / עיר מהרשימה): נזכר בהיסטוריה ואז מדווח
   *  כלפי מעלה. כתובות שמורות לא נכנסות להיסטוריה - הן כבר מוצגות ברשימה. */
  function commitTemporarySelection(address: UserAddress) {
    setRecentLocations(rememberLocation(user?.id, address));
    onSelect(address);
  }

  const [view, setView] = useState<View>("main");
  const [allCities, setAllCities] = useState<{ name: string; country: string }[]>([]);
  const [allCitiesLoading, setAllCitiesLoading] = useState(false);
  // *** תיקון (בקשה מפורשת - "להוסיף חיפוש בתוך הערים והיעדים"): הרשימה
  // כבר נטענת בשלמותה (221 יעדים, ר' handleOpenAllCities) - אין צורך
  // בעוד round-trip לשרת בשביל חיפוש, פשוט מסננים אותה מקומית לפי שם
  // העיר או המדינה. ר' citiesSearchQuery ו-filteredCities למטה.
  const [citiesSearchQuery, setCitiesSearchQuery] = useState("");

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
    }, 450); // תיקון עלויות: הוארך מ-300ms - פחות קריאות בתשלום לגוגל בזמן הקלדה
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

          commitTemporarySelection({
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
          label: data.address_text,
          address_text: data.address_text,
          city: data.city,
          latitude: data.latitude,
          longitude: data.longitude,
        });
        setAddresses((prev) => [saved, ...prev]);
      }
      setView("main");
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

  const filteredCities = citiesSearchQuery.trim()
    ? allCities.filter(
        (city) =>
          city.name.includes(citiesSearchQuery.trim()) || city.country.includes(citiesSearchQuery.trim())
      )
    : allCities;

  function handleOpenAllCities() {
    setView("allCities");
    setCitiesSearchQuery("");
    if (allCities.length > 0) return;
    setAllCitiesLoading(true);
    fetch("/api/places/cities/all")
      .then((res) => res.json())
      .then((data) => setAllCities(data.cities ?? []))
      .catch(() => setAllCities([]))
      .finally(() => setAllCitiesLoading(false));
  }

  function handlePickCity(city: { name: string; country: string }) {
    commitTemporarySelection({
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
    setView("main");
  }

  const titles: Record<View, string> = {
    main: "בחרו את המיקום שלכם",
    addAddress: "הוספת כתובת",
    allCities: "כל הערים שבהן יש Triplace",
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-5 pt-1 text-center">
        <h2 className="text-lg font-bold text-ink">{titles[view]}</h2>
      </div>

      {error && <p className="mt-3 px-5 text-center text-[13px] text-danger">{error}</p>}

      {view === "addAddress" && (
        <div className="flex flex-col gap-3 px-5 pt-5">
          <input
            autoFocus
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            placeholder="חפשו רחוב ומספר בית..."
            className="w-full rounded-card border border-ink-secondary/25 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {savingAddress && <p className="text-center text-sm text-ink-secondary">שומר...</p>}
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
          <button type="button" onClick={() => setView("main")} className="pt-2 text-center text-sm font-semibold text-accent">
            ביטול
          </button>
        </div>
      )}

      {view === "allCities" && (
        <div className="flex flex-col pt-3">
          <button type="button" onClick={() => setView("main")} className="px-5 pb-3 text-start text-sm font-semibold text-accent">
            ← חזרה
          </button>

          {!allCitiesLoading && (
            <div className="px-5 pb-3">
              <input
                autoFocus
                value={citiesSearchQuery}
                onChange={(e) => setCitiesSearchQuery(e.target.value)}
                placeholder="חפשו עיר או מדינה..."
                className="w-full rounded-card border border-ink-secondary/25 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
          )}

          {allCitiesLoading ? (
            <div className="admin-skeleton mx-5 h-16 rounded-card" />
          ) : filteredCities.length === 0 ? (
            <p className="px-5 py-6 text-center text-[13px] text-ink-secondary">
              לא נמצאו יעדים התואמים את החיפוש.
            </p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto overscroll-contain">
              {filteredCities.map((city) => (
                <button
                  key={`${city.name}-${city.country}`}
                  type="button"
                  onClick={() => handlePickCity(city)}
                  className="flex w-full items-center gap-3 border-b border-ink-secondary/10 px-5 py-3 text-start"
                >
                  <PinIcon className="shrink-0 text-ink-secondary" />
                  <span>
                    <span className="block text-[15px] font-semibold text-ink">{city.name}</span>
                    <span className="block text-[12.5px] text-ink-secondary">{city.country}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "main" && (
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

          {recentLocations
            .filter((loc) => !addresses.some((a) => locationKey(a) === locationKey(loc)))
            .map((loc) => (
              <button
                key={`${loc.id}-${locationKey(loc)}`}
                type="button"
                onClick={() => commitTemporarySelection(loc)}
                className="flex items-center gap-3 border-t border-ink-secondary/10 px-5 py-3.5 text-start"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-ink-secondary">
                  <ClockIcon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{loc.city || loc.label}</span>
                  <span className="block truncate text-[13px] text-ink-secondary">
                    {loc.id === "current" ? "המיקום הנוכחי שנבחר לאחרונה" : "נבחר לאחרונה"}
                  </span>
                </span>
              </button>
            ))}

          {loading ? (
            <div className="admin-skeleton mx-5 h-16 rounded-card" />
          ) : (
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
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold text-ink">כל הערים שבהן יש Triplace</span>
          </button>

          <div className="px-5 pb-8 pt-4">
            <button
              type="button"
              onClick={() => setView("addAddress")}
              className="w-full rounded-pill px-6 py-2 text-sm font-semibold text-white shadow-soft"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              הוספת כתובת
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
