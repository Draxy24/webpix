"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface AuthContextType {
  token: string | null;
  nickname: string | null;
  login: (token: string, nickname: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  nickname: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedNickname = localStorage.getItem("nickname");
    if (savedToken) setToken(savedToken);
    if (savedNickname) setNickname(savedNickname);
  }, []);

  const login = (token: string, nickname: string) => {
    localStorage.setItem("token", token);
    localStorage.setItem("nickname", nickname);
    setToken(token);
    setNickname(nickname);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("nickname");
    setToken(null);
    setNickname(null);
  };

  return (
    <AuthContext.Provider value={{ token, nickname, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);