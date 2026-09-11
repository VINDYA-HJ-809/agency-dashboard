import React, { createContext, useContext, useEffect, useState } from "react";
import { api, setAccessToken } from "./api";

type User = { id: string; name: string; email: string; role: "ADMIN" | "PM" | "DEVELOPER" };

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On app load, try to silently refresh using the httpOnly cookie
    api
      .post("/auth/refresh")
      .then((res) => {
        setAccessToken(res.data.accessToken);
        setUser(res.data.user);
      })
      .catch(() => {
        // not logged in, that's fine
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
  }

  async function logout() {
    await api.post("/auth/logout");
    setAccessToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
