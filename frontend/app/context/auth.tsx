"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { API_URL } from "@/app/lib/api";

interface AuthContextType {
  token: string | null;
  nickname: string | null;
  loading: boolean;
  login: (token: string, nickname: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  nickname: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

// Cada cuánto renovamos el access token en segundo plano.
// Debe ser MENOR que el expiresIn del JWT (15 min) para que nunca caduque en uso.
const REFRESH_INTERVAL_MS = 14 * 60 * 1000; // 14 min

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pide un access token nuevo usando la cookie httpOnly (webpix_rt).
  // Devuelve el token nuevo o null si la sesión ya no es válida.
  const doRefresh = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(API_URL + "/auth/refresh", {
        method: "POST",
        credentials: "include", // manda la cookie webpix_rt
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
        return data.token;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const login = useCallback((token: string, nickname: string) => {
    localStorage.setItem("token", token);
    localStorage.setItem("nickname", nickname);
    setToken(token);
    setNickname(nickname);
  }, []);

  const logout = useCallback(() => {
    // Revoca el refresh token en el server y limpia la cookie.
    fetch(API_URL + "/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    localStorage.removeItem("token");
    localStorage.removeItem("nickname");
    setToken(null);
    setNickname(null);
  }, []);

  // Al montar: recuperamos nickname/token de localStorage para pintar rápido,
  // pero SIEMPRE intentamos un refresh contra la cookie, que es la fuente de
  // verdad de la sesión (el access token de localStorage pudo caducar).
  useEffect(() => {
    const savedNickname = localStorage.getItem("nickname");
    if (savedNickname) setNickname(savedNickname);

    (async () => {
      const fresh = await doRefresh();
      if (!fresh) {
        // No hay sesión válida por cookie. Si había restos en localStorage,
        // los conservamos por ahora: si el token viejo aún sirve, funciona;
        // si no, la primera llamada 401 hará que page.tsx caiga a anónimo.
        const savedToken = localStorage.getItem("token");
        if (savedToken) setToken(savedToken);
      }
      setLoading(false);
    })();
  }, [doRefresh]);

  // Refresh proactivo: mientras haya sesión, renovamos cada 14 min para que
  // el access token nunca caduque estando el usuario activo.
  useEffect(() => {
    if (!token) {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
        refreshTimer.current = null;
      }
      return;
    }
    refreshTimer.current = setInterval(() => {
      doRefresh();
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
  }, [token, doRefresh]);

  return (
    <AuthContext.Provider value={{ token, nickname, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
