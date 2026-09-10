/* eslint-disable @typescript-eslint/no-explicit-any */
// ─── Server Functions ────────────────────────────────────────────────
// Apenas autenticação (login/logout/session) executada no servidor.
// O CRUD de dados passou inteiramente para Firebase Firestore (store.ts).
//
// A autenticação usa Firebase Admin SDK para ler utilizadores da
// coleção "users" do Firestore, com bcrypt para validar passwords
// e JWT para gerir sessões via cookies HTTP-only.

import { createServerFn } from "@tanstack/react-start";
import type { UserProfile, UserRole } from "./types";

// ═══════════════════════════════════════════════════════════════
// CONSTANTES E HELPERS INTERNOS
// ═══════════════════════════════════════════════════════════════

const COOKIE_NAME = "guideeasy_session";
const TOKEN_EXPIRY = "7d";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 dias

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not defined!");
    }
    return "CHANGE_ME_IN_DEVELOPMENT_ONLY";
  }
  return secret;
}

// ─── Firebase Admin SDK (lazy init) ──────────────────────────────────

let _adminApp: any = null;
let _adminDb: any = null;

async function getAdminFirestore() {
  if (_adminDb) return _adminDb;

  const admin = (await import("firebase-admin")).default;

  if (!_adminApp) {
    // Tentar inicializar com Service Account do .env
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccountEnv && serviceAccountEnv.trim().length > 10) {
      try {
        let jsonStr = serviceAccountEnv.trim();
        if (jsonStr.startsWith("'") && jsonStr.endsWith("'")) {
          jsonStr = jsonStr.slice(1, -1);
        }
        const serviceAccount = JSON.parse(jsonStr);
        _adminApp = admin.apps.length
          ? admin.app()
          : admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
            });
      } catch (err) {
        console.error("[auth] Falha ao inicializar Firebase Admin com Service Account:", err);
        throw new Error("Configuração Firebase Admin inválida");
      }
    } else {
      // Fallback: Application Default Credentials
      _adminApp = admin.apps.length
        ? admin.app()
        : admin.initializeApp({
            projectId: "n8n-prudencio",
          });
    }
  }

  _adminDb = admin.firestore(_adminApp);
  return _adminDb;
}

// ─── Cookie / JWT helpers ────────────────────────────────────────────

async function getSessionFromRequest(): Promise<UserProfile | null> {
  try {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(COOKIE_NAME);
    if (!token) return null;

    const tokenStr = decodeURIComponent(token);
    const jwt = (await import("jsonwebtoken")).default;

    const payload = jwt.verify(tokenStr, jwtSecret()) as {
      userId: string;
      email: string;
      name: string;
      role: UserRole;
    };

    return {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

async function setAuthCookie(token: string, maxAge: number): Promise<void> {
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });
  } catch (err) {
    console.warn("[auth] Não foi possível definir cookie:", err);
  }
}

async function clearAuthCookie(): Promise<void> {
  try {
    const { deleteCookie } = await import("@tanstack/react-start/server");
    deleteCookie(COOKIE_NAME, {
      path: "/",
    });
  } catch (err) {
    console.warn("[auth] Não foi possível limpar cookie:", err);
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTENTICAÇÃO (Firebase Admin SDK + Firestore)
// ═══════════════════════════════════════════════════════════════

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    try {
      const db = await getAdminFirestore();
      const bcrypt = (await import("bcryptjs")).default;
      const jwt = (await import("jsonwebtoken")).default;

      // Procurar utilizador na coleção "users" do Firestore
      const usersSnap = await db
        .collection("users")
        .where("email", "==", data.email.toLowerCase().trim())
        .limit(1)
        .get();

      if (usersSnap.empty) throw new Error("Email ou password incorretos");

      const userDoc = usersSnap.docs[0];
      const user = userDoc.data();

      const valid = await bcrypt.compare(data.password, user.password_hash);
      if (!valid) throw new Error("Email ou password incorretos");

      const token = jwt.sign(
        {
          userId: userDoc.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        jwtSecret(),
        { expiresIn: TOKEN_EXPIRY },
      );

      await setAuthCookie(token, COOKIE_MAX_AGE);

      return {
        id: userDoc.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
      } satisfies UserProfile;
    } catch (err: any) {
      console.error("[loginFn Error Server-Side]:", err);
      throw new Error(err.message || "Erro de servidor ao fazer login");
    }
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await clearAuthCookie();
  return { ok: true };
});

export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  return getSessionFromRequest();
});
