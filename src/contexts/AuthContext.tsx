import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, ALLOWED_EMAIL, DEFAULT_PASSWORD } from "@/lib/firebase";

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updatePassword: (newPassword: string) => Promise<void>;
  getCurrentPassword: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const SESSION_KEY = "apkSaverAuth";

async function ensureAuthDoc(): Promise<string> {
  const ref = doc(db, "config", "auth");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { password: DEFAULT_PASSWORD });
    return DEFAULT_PASSWORD;
  }
  const data = snap.data() as { password?: string };
  return data.password || DEFAULT_PASSWORD;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem(SESSION_KEY) === "1"
  );

  useEffect(() => {
    // Seed auth doc on first load (silent)
    ensureAuthDoc().catch(() => {});
  }, []);

  const login: AuthContextValue["login"] = async (email, password) => {
    if (email.trim().toLowerCase() !== ALLOWED_EMAIL) {
      return { ok: false, error: "Invalid email or password." };
    }
    try {
      const current = await ensureAuthDoc();
      if (password !== current) {
        return { ok: false, error: "Invalid email or password." };
      }
      localStorage.setItem(SESSION_KEY, "1");
      setIsAuthenticated(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "Could not reach server. Check your connection." };
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false);
  };

  const updatePassword = async (newPassword: string) => {
    await setDoc(doc(db, "config", "auth"), { password: newPassword });
  };

  const getCurrentPassword = async () => ensureAuthDoc();

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, updatePassword, getCurrentPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
