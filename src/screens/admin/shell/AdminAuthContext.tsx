"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "triplace_admin_secret";

interface AdminAuthContextValue {
  secret: string;
  setSecret: (secret: string) => void;
  clearSecret: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  secret: "",
  setSecret: () => {},
  clearSecret: () => {},
});

/** מחליף את הדפוס הישן (כל עמוד עם useState("") נפרד לסיסמה, שדורש הקלדה
 *  מחדש בכל מעבר עמוד/רענון) - סיסמה אחת, פעם אחת, נשמרת ב-localStorage,
 *  זמינה לכל עמודי האדמין דרך useAdminSecret(). */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [secret, setSecretState] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setSecretState(window.localStorage.getItem(STORAGE_KEY) ?? "");
    } catch {
      // localStorage לא זמין - נשאר ריק, המשתמש יזין ידנית
    }
    setLoaded(true);
  }, []);

  function setSecret(next: string) {
    setSecretState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // לא קריטי - עדיין עובד לתוך ה-session הנוכחי
    }
  }

  function clearSecret() {
    setSecretState("");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // לא קריטי
    }
  }

  // לפני שנטען מ-localStorage - לא מרנדרים כלום, כדי לא "להבהב" מסך
  // התחברות לרגע ואז להיעלם ברגע שהסיסמה נמצאת.
  if (!loaded) return null;

  return <AdminAuthContext.Provider value={{ secret, setSecret, clearSecret }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminSecret() {
  return useContext(AdminAuthContext);
}
