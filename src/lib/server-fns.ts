/* eslint-disable @typescript-eslint/no-explicit-any */
// --- Server Functions ------------------------------------------------
// Apenas autenticacao (login/logout/session) executada no servidor.
// O CRUD de dados passou inteiramente para Firebase Firestore (store.ts).
//
// A autenticacao valida credenciais contra:
//  1. Utilizadores registados no Firestore (via REST API), se acessivel
//  2. Credenciais de admin definidas no .env (ADMIN_EMAIL/ADMIN_PASSWORD)
//     como fallback quando o Firestore nao tem a colecao users acessivel
//
// Sessoes geridas via JWT em cookies HTTP-only.

import { createServerFn } from "@tanstack/react-start";
import type { UserProfile, UserRole } from "./types";

// =================================================================
// CONSTANTES E HELPERS INTERNOS
// =================================================================

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

// --- Firestore REST API helpers --------------------------------------

const FIREBASE_API_KEY = "AIzaSyClBw569jLYXKWL6lr5hYl-3ppCT7_PzJg";
const FIREBASE_PROJECT_ID = "n8n-prudencio";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function fromFirestoreValue(val: any): any {
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return Number(val.integerValue);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.nullValue !== undefined) return null;
  if (val.mapValue !== undefined) {
    const obj: any = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  if (val.arrayValue !== undefined) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  return val;
}

function docToObject(doc: any): any {
  const obj: any = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    obj[k] = fromFirestoreValue(v);
  }
  return obj;
}

/** Procurar utilizador por email via Firestore REST API */
async function findUserByEmail(email: string): Promise<{ id: string; data: any } | null> {
  try {
    const url = `${FIRESTORE_BASE}:runQuery?key=${FIREBASE_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "users" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "email" },
              op: "EQUAL",
              value: { stringValue: email },
            },
          },
          limit: 1,
        },
      }),
    });

    if (!response.ok) return null;

    const results = await response.json();
    if (!results || !results[0] || !results[0].document) return null;

    const doc = results[0].document;
    const data = docToObject(doc);
    const parts = (doc.name || "").split("/");
    const id = parts[parts.length - 1];

    return { id, data };
  } catch {
    return null;
  }
}

// --- Autenticacao com fallback para admin do .env --------------------

async function authenticateUser(
  email: string,
  password: string
): Promise<UserProfile> {
  const bcrypt = (await import("bcryptjs")).default;

  // 1. Tentar encontrar no Firestore
  const firestoreUser = await findUserByEmail(email);
  if (firestoreUser) {
    const valid = await bcrypt.compare(password, firestoreUser.data.password_hash);
    if (!valid) throw new Error("Email ou password incorretos");
    return {
      id: firestoreUser.id,
      email: firestoreUser.data.email,
      name: firestoreUser.data.name,
      role: firestoreUser.data.role as UserRole,
    };
  }

  // 2. Fallback: verificar contra credenciais admin do .env
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@prudencio.pt").toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || "Rpavg5n";
  const adminName = process.env.ADMIN_NAME || "Administrador";

  if (email.toLowerCase().trim() === adminEmail && password === adminPassword) {
    console.log("[auth] Login via credenciais admin do .env (Firestore users nao acessivel)");
    return {
      id: "admin-env",
      email: adminEmail,
      name: adminName,
      role: "admin",
    };
  }

  throw new Error("Email ou password incorretos");
}

// --- Cookie / JWT helpers --------------------------------------------

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
    console.warn("[auth] Nao foi possivel definir cookie:", err);
  }
}

async function clearAuthCookie(): Promise<void> {
  try {
    const { deleteCookie } = await import("@tanstack/react-start/server");
    deleteCookie(COOKIE_NAME, {
      path: "/",
    });
  } catch (err) {
    console.warn("[auth] Nao foi possivel limpar cookie:", err);
  }
}

// =================================================================
// AUTENTICACAO
// =================================================================

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    try {
      const jwt = (await import("jsonwebtoken")).default;

      const user = await authenticateUser(data.email, data.password);

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        jwtSecret(),
        { expiresIn: TOKEN_EXPIRY },
      );

      await setAuthCookie(token, COOKIE_MAX_AGE);

      return user;
    } catch (err: any) {
      console.error("[loginFn Error Server-Side]:", err.message);
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
