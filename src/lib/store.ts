// ─── Camada de persistência ──────────────────────────────────────────
// Todas as operações de dados passam exclusivamente pelo Firebase Firestore.
// A autenticação (login/logout/session) continua em server-fns.ts.

import {
  createChecklist,
  getChecklist,
  listChecklists,
  updateChecklist,
  deleteChecklist,
  deleteAllChecklists,
  createObra,
  listObras,
  getObra,
  updateObra,
  deleteObra,
  logUser,
  createActivityLog,
  listActivityLogs,
  deleteActivityLog,
  deleteAllActivityLogs,
} from "./firebase";
import type { Checklist, ChecklistItem, PdfMetadata, Obra } from "./types";
import type { ActivityLog } from "./firebase";

export type { Checklist, ChecklistItem, PdfMetadata, Obra, ActivityLog };

// ─── OBRAS — CREATE ──────────────────────────────────────────────────

export async function createObraStore(o: Omit<Obra, "id">): Promise<string> {
  return createObra(o);
}

// ─── OBRAS — LIST ────────────────────────────────────────────────────

export async function listObrasStore(): Promise<Obra[]> {
  return listObras();
}

// ─── OBRAS — GET (single) ────────────────────────────────────────────

export async function getObraStore(id: string): Promise<Obra | null> {
  return getObra(id);
}

// ─── OBRAS — UPDATE (inclui Terminar Obra) ───────────────────────────

export async function updateObraStore(id: string, patch: Partial<Obra>): Promise<void> {
  await updateObra(id, patch);
}

// ─── OBRAS — DELETE ──────────────────────────────────────────────────

export async function deleteObraStore(id: string): Promise<void> {
  await deleteObra(id);
}

// ─── CREATE CHECKLIST ────────────────────────────────────────────────

export async function createChecklistStore(c: Omit<Checklist, "id">): Promise<string> {
  return createChecklist(c);
}

// ─── READ (single) ───────────────────────────────────────────────────

export async function getChecklistStore(id: string): Promise<Checklist | null> {
  return getChecklist(id);
}

// ─── LIST ────────────────────────────────────────────────────────────

export async function listChecklistsStore(obraId?: string): Promise<Checklist[]> {
  const all = await listChecklists();
  return obraId ? all.filter((c) => c.obra_id === obraId) : all;
}

// ─── LIST WITH ITEMS (para cálculo de stock) ─────────────────────────

export async function listChecklistsWithItemsStore(obraId: string): Promise<Checklist[]> {
  const all = await listChecklists();
  return all.filter((c) => c.obra_id === obraId);
}

// ─── UPDATE ──────────────────────────────────────────────────────────

export async function updateChecklistStore(id: string, patch: Partial<Checklist>) {
  await updateChecklist(id, patch);
}

// ─── DELETE (single) ─────────────────────────────────────────────────

export async function deleteChecklistStore(id: string): Promise<void> {
  await deleteChecklist(id);
}

// ─── DELETE ALL ──────────────────────────────────────────────────────

export async function deleteAllChecklistsStore(): Promise<void> {
  await deleteAllChecklists();
}

// ─── LOG USER ────────────────────────────────────────────────────────

export async function logUserStore(name: string, phone: string): Promise<void> {
  await logUser(name, phone);
}

// ─── ACTIVITY LOG (Histórico) ────────────────────────────────────────

export async function logActivity(
  action: string,
  entityType: string,
  entityId?: string,
  entityName?: string,
  userEmail?: string,
  userName?: string,
  details?: string
): Promise<void> {
  try {
    await createActivityLog({
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      user_email: userEmail,
      user_name: userName,
      details,
      created_at: Date.now(),
    });
  } catch (e) {
    console.warn("logActivity falhou:", e);
  }
}

export async function listActivityLogsStore(): Promise<ActivityLog[]> {
  return listActivityLogs();
}

export async function deleteActivityLogStore(id: string): Promise<void> {
  await deleteActivityLog(id);
}

export async function deleteAllActivityLogsStore(): Promise<void> {
  await deleteAllActivityLogs();
}
