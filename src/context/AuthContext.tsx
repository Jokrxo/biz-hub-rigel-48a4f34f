import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, AuthUser } from "@/lib/api";
import { clearAuthToken, getAuthToken, setAuthToken } from "@/lib/storage";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const token = getAuthToken();
        if (token) {
          const me = await api.me();
          setUser(me);
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email: string, password: string, remember: boolean) => {
    const res = await api.login({ email, password });
    setAuthToken(res.token, remember);
    const me = res.user ?? (await api.me());
    setUser(me);
  };

  const signup = async (name: string, email: string, password: string) => {
    const res = await api.signup({ name, email, password });
    setAuthToken(res.token, true);
    const me = res.user ?? (await api.me());
    setUser(me);
  };

  const forgotPassword = async (email: string) => {
    await api.forgotPassword({ email });
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, signup, forgotPassword, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
