import React, { createContext, useContext, useEffect, useState } from "react";
import { loginFn, logoutFn, getSessionFn } from "./server-fns";
import type { UserProfile, UserRole } from "./types";

export type { UserRole, UserProfile };

type AuthContextType = {
  /** Perfil do utilizador autenticado (ou null se não autenticado) */
  user: UserProfile | null;
  /** Alias para user — compatibilidade com código existente */
  profile: UserProfile | null;
  loading: boolean;
  /** Fazer login com email e password */
  login: (email: string, password: string) => Promise<UserProfile>;
  /** Terminar sessão */
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  login: async () => {
    throw new Error("AuthProvider não montado");
  },
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sessão existente (cookie HTTP-only) no arranque
    getSessionFn()
      .then((session) => setUser(session ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<UserProfile> => {
    const profile = await loginFn({ data: { email, password } });
    setUser(profile);
    return profile;
  };

  const logout = async () => {
    setLoading(true);
    try {
      await logoutFn();
    } catch (e) {
      console.error("Logout falhou:", e);
    }
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile: user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
