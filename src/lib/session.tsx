import React, { createContext, useContext, useEffect, useState } from "react";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, firebaseConfigStatus, firestore } from "./firebase";
import type { UserProfile, UserRole } from "./types";

export type { UserRole, UserProfile };

type AuthContextType = {
  /** Perfil do utilizador autenticado (ou null se não autenticado) */
  user: UserProfile | null;
  /** Alias para user — compatibilidade com código existente */
  profile: UserProfile | null;
  loading: boolean;
  /** Fazer login com Firebase Authentication */
  login: (email: string, password: string) => Promise<UserProfile>;
  /** Terminar sessão no Firebase Authentication */
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

function firebaseConfigError(): Error {
  const missing = firebaseConfigStatus.missing.join(", ");
  return new Error(
    missing
      ? "Firebase não está configurado. Defina estas variáveis: " + missing + "."
      : "Firebase Authentication não está disponível neste ambiente.",
  );
}

function firebaseAuthError(error: unknown): Error {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(code)) {
    return new Error("E-mail ou palavra-passe incorretos.");
  }
  if (code === "auth/too-many-requests") {
    return new Error("Demasiadas tentativas. Aguarde alguns minutos e tente novamente.");
  }
  if (code === "auth/operation-not-allowed") {
    return new Error("O login por e-mail ainda não está ativo no Firebase Authentication.");
  }
  if (code === "auth/invalid-api-key") {
    return firebaseConfigError();
  }

  return error instanceof Error ? error : new Error("Não foi possível iniciar sessão.");
}

async function toUserProfile(firebaseUser: FirebaseUser): Promise<UserProfile> {
  const fallbackName = firebaseUser.displayName?.trim() || firebaseUser.email || "Utilizador";
  let name = fallbackName;
  let role: UserRole = "operator";

  try {
    const snapshot = await getDoc(doc(firestore, "users", firebaseUser.uid));
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (typeof data.name === "string" && data.name.trim()) name = data.name.trim();
      if (data.role === "admin" || data.role === "operator") role = data.role;
    }
  } catch (error) {
    // O perfil é opcional. A ausência dele nunca deve elevar permissões.
    console.warn("Não foi possível carregar o perfil Firestore:", error);
  }

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || "",
    name,
    role,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let mounted = true;
    void setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn("Não foi possível ativar a persistência local do login:", error);
    });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      void toUserProfile(firebaseUser).then((profile) => {
        if (mounted) {
          setUser(profile);
          setLoading(false);
        }
      });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<UserProfile> => {
    if (!auth) throw firebaseConfigError();

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await toUserProfile(credential.user);
      setUser(profile);
      return profile;
    } catch (error) {
      throw firebaseAuthError(error);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (auth) await signOut(auth);
    } catch (error) {
      console.error("Logout falhou:", error);
    } finally {
      setUser(null);
      setLoading(false);
    }
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
