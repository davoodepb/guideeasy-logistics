import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, push, set, get, child, update } from "firebase/database";

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

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Lazy analytics (browser only)
export async function initAnalytics() {
  if (typeof window === "undefined") return;
  try {
    const { isSupported, getAnalytics } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(app);
  } catch {
    /* ignore */
  }
}

export type ChecklistItem = {
  artigo: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  checked?: boolean;
};

/** Metadata extracted from PDF — all extra fields */
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
  data_documento?: string; // ex: 2026-05-05
  data_carga?: string; // ex: 2026-05-06
  hora_carga?: string; // ex: 07:00
  numero_guia?: string; // ex: GT.2026/67
  // Extra PDF metadata
  pdf_metadata?: PdfMetadata;
};

export async function createChecklist(c: Omit<Checklist, "id">): Promise<string> {
  const r = push(ref(db, "checklists"));
  const id = r.key!;
  await set(r, { ...c, id });
  return id;
}

export async function getChecklist(id: string): Promise<Checklist | null> {
  const snap = await get(child(ref(db), `checklists/${id}`));
  return snap.exists() ? (snap.val() as Checklist) : null;
}

export async function listChecklists(): Promise<Checklist[]> {
  try {
    const snap = await get(child(ref(db), `checklists`));
    if (!snap.exists()) return [];
    const v = snap.val() as Record<string, Checklist>;
    return Object.values(v).sort((a, b) => b.created_at - a.created_at);
  } catch (e) {
    console.warn("listChecklists falhou (verifique regras Firebase RTDB):", e);
    return [];
  }
}

export async function updateChecklist(id: string, patch: Partial<Checklist>) {
  await update(ref(db, `checklists/${id}`), patch);
}

export async function logUser(name: string, phone: string) {
  try {
    const r = push(ref(db, "users"));
    await set(r, { name, phone, created_at: Date.now() });
  } catch (e) {
    console.warn("logUser falhou (regras Firebase):", e);
  }
}
