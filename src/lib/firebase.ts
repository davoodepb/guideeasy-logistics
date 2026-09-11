/**
 * ═══════════════════════════════════════════════════════════════
 * Firebase Client SDK — Configuração Central
 * Projeto: n8n-prudencio
 *
 * Este ficheiro:
 *  1. Inicializa o Firebase App (singleton, seguro para SSR)
 *  2. Exporta instâncias prontas de Auth, Firestore e Storage
 *  3. RTDB disponível via databaseURL configurado
 *  4. Todo o CRUD de Checklists, Obras e Users (Firestore)
 * ═══════════════════════════════════════════════════════════════
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  push,
  set,
  get,
  child,
  update,
  remove,
} from "firebase/database";
import type { Database } from "firebase/database";
import { getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";

// ─── Configuração Firebase (projeto n8n-prudencio) ──────────────────
const firebaseConfig = {
  apiKey: "AIzaSyClBw569jLYXKWL6lr5hYl-3ppCT7_PzJg",
  authDomain: "n8n-prudencio.firebaseapp.com",
  databaseURL: "https://n8n-prudencio-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "n8n-prudencio",
  storageBucket: "n8n-prudencio.firebasestorage.app",
  messagingSenderId: "397008230620",
  appId: "1:397008230620:web:a17568b43bca763719bc19",
  measurementId: "G-EJEFSVQHLD",
};

// ─── Singleton App ───────────────────────────────────────────────────
export const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

// ─── Serviços Prontos a Usar ─────────────────────────────────────────

/** Firebase Authentication */
export const auth: Auth = getAuth(app);

/** Cloud Firestore (com cache local persistente para offline) */
export const firestore: Firestore = (() => {
  try {
    if (typeof window !== "undefined") {
      return initializeFirestore(app, {
        localCache: persistentLocalCache(),
      });
    }
    return getFirestore(app);
  } catch {
    return getFirestore(app);
  }
})();

/** Realtime Database */
let _db: Database | null = null;
export function getRtdb(): Database {
  if (_db) return _db;
  _db = getDatabase(app);
  return _db;
}

// Exportar `db` como getter lazy para compatibilidade
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const realDb = getRtdb();
    const value = Reflect.get(realDb, prop, receiver);
    return typeof value === "function" ? value.bind(realDb) : value;
  },
});

/** Cloud Storage (para ficheiros/PDFs) */
export const storage: FirebaseStorage = getStorage(app);

// ─── Analytics (lazy, apenas browser) ────────────────────────────────
export async function initAnalytics() {
  if (typeof window === "undefined") return;
  try {
    const { isSupported, getAnalytics } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(app);
  } catch {
    /* analytics não suportado neste browser */
  }
}

// ─── Tipos ───────────────────────────────────────────────────────────

export type ChecklistItem = {
  artigo: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  checked?: boolean;
};

/** Metadata extraída do PDF */
export type PdfMetadata = {
  emissor_empresa?: string;
  emissor_contribuinte?: string;
  emissor_morada?: string;
  emissor_contactos?: string;
  emissor_capital_social?: string;
  destinatario_nome?: string;
  destinatario_morada?: string;
  tipo_documento?: string;
  vn_contrib?: string;
  atcud?: string;
  carga_local?: string;
  descarga_local?: string;
  descarga_morada?: string;
  disponibilizacao?: string;
  certificacao?: string;
  qr_raw?: string;
};

export type Obra = {
  id: string;
  nome: string;
  descricao?: string;
  status: "ativa" | "terminada";
  created_by?: string;
  terminated_at?: number;
  created_at: number;
};

export type Checklist = {
  id: string;
  codigo_at: string;
  observacoes_renato: string;
  items: ChecklistItem[];
  status: "pendente" | "concluida";
  created_at: number;
  created_by?: string;
  responsavel?: string;
  observacoes_colaborador?: string;
  submitted_at?: number;
  // Datas extraídas do PDF
  data_documento?: string;
  data_carga?: string;
  hora_carga?: string;
  numero_guia?: string;
  pdf_name?: string;
  pdf_metadata?: PdfMetadata;
  // Associação a Obra
  obra_id?: string;
  obra_nome?: string;
  // Tipo de documento
  tipo_guia?: "transporte" | "devolucao";
};

// ─── Firestore CRUD (Checklists) ─────────────────────────────────────

const checklistsCol = () => collection(firestore, "checklists");

export async function createChecklist(
  c: Omit<Checklist, "id">
): Promise<string> {
  const docRef = await addDoc(checklistsCol(), { ...c, created_at: c.created_at || Date.now() });
  await updateDoc(docRef, { id: docRef.id });
  return docRef.id;
}

export async function getChecklist(id: string): Promise<Checklist | null> {
  const snap = await getDoc(doc(firestore, "checklists", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Checklist) : null;
}

export async function listChecklists(): Promise<Checklist[]> {
  try {
    const q = query(checklistsCol(), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    return snap.docs
      .filter((d) => d.id !== "placeholder")
      .map((d) => ({ id: d.id, ...d.data() } as Checklist));
  } catch (e) {
    console.warn("listChecklists falhou (verifique regras Firestore):", e);
    return [];
  }
}

export async function updateChecklist(id: string, patch: Partial<Checklist>) {
  await updateDoc(doc(firestore, "checklists", id), patch);
}

export async function deleteChecklist(id: string): Promise<void> {
  await deleteDoc(doc(firestore, "checklists", id));
}

export async function deleteAllChecklists(): Promise<void> {
  const snap = await getDocs(checklistsCol());
  const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);
}

// ─── Firestore CRUD (Obras) ──────────────────────────────────────────

const obrasCol = () => collection(firestore, "obras");

export async function createObra(o: Omit<Obra, "id">): Promise<string> {
  const docRef = await addDoc(obrasCol(), { ...o, created_at: o.created_at || Date.now() });
  await updateDoc(docRef, { id: docRef.id });
  return docRef.id;
}

export async function listObras(): Promise<Obra[]> {
  try {
    const q = query(obrasCol(), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    return snap.docs
      .filter((d) => d.id !== "placeholder")
      .map((d) => ({ id: d.id, ...d.data() } as Obra));
  } catch (e) {
    console.warn("listObras falhou:", e);
    return [];
  }
}

export async function getObra(id: string): Promise<Obra | null> {
  const snap = await getDoc(doc(firestore, "obras", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Obra) : null;
}

export async function updateObra(id: string, patch: Partial<Obra>) {
  await updateDoc(doc(firestore, "obras", id), patch);
}

export async function deleteObra(id: string): Promise<void> {
  await deleteDoc(doc(firestore, "obras", id));
}

// ─── Utilitários ─────────────────────────────────────────────────────

export async function logUser(name: string, phone: string) {
  try {
    await addDoc(collection(firestore, "app_users"), {
      name,
      phone,
      created_at: Date.now(),
    });
  } catch (e) {
    console.warn("logUser falhou (regras Firebase):", e);
  }
}

// ─── Firestore CRUD (Histórico / Activity Log) ──────────────────────

export type ActivityLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  user_email?: string;
  user_name?: string;
  details?: string;
  created_at: number;
};

const activityCol = () => collection(firestore, "activity_log");

export async function createActivityLog(
  log: Omit<ActivityLog, "id">
): Promise<string> {
  const docRef = await addDoc(activityCol(), {
    ...log,
    created_at: log.created_at || Date.now(),
  });
  await updateDoc(docRef, { id: docRef.id });
  return docRef.id;
}

export async function listActivityLogs(): Promise<ActivityLog[]> {
  try {
    const q = query(activityCol(), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
  } catch (e) {
    console.warn("listActivityLogs falhou:", e);
    return [];
  }
}

export async function deleteActivityLog(id: string): Promise<void> {
  await deleteDoc(doc(firestore, "activity_log", id));
}

export async function deleteAllActivityLogs(): Promise<void> {
  const snap = await getDocs(activityCol());
  const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);
}
