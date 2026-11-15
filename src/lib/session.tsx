import React, { createContext, useContext, useState } from "react";
import type { UserProfile, UserRole } from "./types";

export type { UserRole, UserProfile };

type AuthContextType = {
  /** Perfil do utilizador (sempre autenticado como admin) */
  user: UserProfile;
  /** Alias para user — compatibilidade com código existente */
  profile: UserProfile;
  loading: boolean;
  /** Login mantido por compatibilidade — retorna admin automaticamente */
  login: (email: string, password: string) => Promise<UserProfile>;
  /** Logout mantido por compatibilidade — não faz nada */
  logout: () => Promise<void>;
};

const adminUser: UserProfile = {
  id: "admin-auto",
  email: "admin@prudencio.pt",
  name: "Administrador",
  role: "admin",
};

const AuthContext = createContext<AuthContextType>({
  user: adminUser,
  profile: adminUser,
  loading: false,
  login: async () => adminUser,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user] = useState<UserProfile>(adminUser);

  const login = async (): Promise<UserProfile> => adminUser;
  const logout = async () => {};

  return (
    <AuthContext.Provider value={{ user, profile: user, loading: false, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
