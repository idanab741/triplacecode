"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";

/** fetch עם סיסמת האדמין. 401 מנתק אוטומטית (סיסמה שגויה/שונתה). */
export function useAdminFetch() {
  const { secret, clearSecret } = useAdminSecret();
  return useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", "x-admin-secret": secret, ...(init?.headers ?? {}) },
        cache: "no-store",
      });
      if (res.status === 401) {
        clearSecret();
        throw new Error("הסיסמה אינה בתוקף - יש להתחבר מחדש");
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? `שגיאה ${res.status}`);
      return body as T;
    },
    [secret, clearSecret]
  );
}

/** טעינת נתונים עם מצב טעינה/שגיאה, רענון ידני ורענון אוטומטי אופציונלי.
 *  נתונים קודמים נשמרים על המסך בזמן רענון (בלי "הבהוב" לשלד). */
export function useAdminData<T>(url: string | null, { refreshMs }: { refreshMs?: number } = {}) {
  const request = useAdminFetch();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const id = ++seq.current;
    setLoading(true);
    try {
      const body = await request<T>(url);
      if (id !== seq.current) return;
      setData(body);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (err) {
      if (id !== seq.current) return;
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [url, request]);

  useEffect(() => {
    // טעינה מחדש בכל שינוי URL (טווח/פילטר)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!refreshMs) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, refreshMs);
    return () => window.clearInterval(t);
  }, [load, refreshMs]);

  return { data, error, loading, reload: load, updatedAt };
}

/** טווח זמן שנשמר בין מסכים (localStorage). */
export function useStoredRange<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setValue(stored as T);
    } catch {
      // לא זמין - נשארים עם ברירת המחדל
    }
  }, [key]);
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, v);
      } catch {
        // לא קריטי
      }
    },
    [key]
  );
  return [value, set];
}
