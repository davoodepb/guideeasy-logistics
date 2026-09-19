// ─── Camada de persistência ──────────────────────────────────────────
// Todas as operações de dados passam exclusivamente pelo Firebase Firestore.
// A autenticação (login/logout/session) usa Firebase Authentication.

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
  auth,
} from "./firebase";
import type { Checklist, ChecklistItem, PdfMetadata, Obra } from "./types";
import type { ActivityLog } from "./firebase";

export type { Checklist, ChecklistItem, PdfMetadata, Obra, ActivityLog };

// ─── OBRAS — CREATE ──────────────────────────────────────────────────

export async function createObraStore(o: Omit<Obra, "id">): Promise<string> {
  const id = await createObra(o);
  await logActivity("criar_obra", "obra", id, o.nome, undefined, o.created_by);
  return id;
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
  const existing = await getObra(id);
  await updateObra(id, patch);
  await logActivity(
    patch.status === "terminada" ? "terminar_obra" : "editar_obra",
    "obra",
    id,
    patch.nome || existing?.nome || id,
    undefined,
    existing?.created_by,
  );
}

// ─── OBRAS — DELETE ──────────────────────────────────────────────────

export async function deleteObraStore(id: string): Promise<void> {
  const existing = await getObra(id);
  await deleteObra(id);
  await logActivity(
    "apagar_obra",
    "obra",
    id,
    existing?.nome || id,
    undefined,
    existing?.created_by,
  );
}

// ─── CREATE CHECKLIST ────────────────────────────────────────────────

export async function createChecklistStore(c: Omit<Checklist, "id">): Promise<string> {
  const id = await createChecklist(c);
  await logActivity(
    "criar_guia",
    "guia",
    id,
    c.numero_guia || c.codigo_at || c.pdf_name || id,
    undefined,
    c.created_by,
  );
  return id;
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
  const existing = await getChecklist(id);
  await updateChecklist(id, patch);
  await logActivity(
    patch.status === "concluida" ? "concluir_guia" : "editar_guia",
    "guia",
    id,
    patch.numero_guia || patch.codigo_at || existing?.numero_guia || existing?.codigo_at || id,
    undefined,
    existing?.created_by,
  );
}

// ─── DELETE (single) ─────────────────────────────────────────────────

export async function deleteChecklistStore(id: string): Promise<void> {
  const existing = await getChecklist(id);
  await deleteChecklist(id);
  await logActivity(
    "apagar_guia",
    "guia",
    id,
    existing?.numero_guia || existing?.codigo_at || existing?.pdf_name || id,
    undefined,
    existing?.created_by,
  );
}

// ─── DELETE ALL ──────────────────────────────────────────────────────

export async function deleteAllChecklistsStore(): Promise<void> {
  await deleteAllChecklists();
}

// ─── LOG USER ────────────────────────────────────────────────────────

export async function logUserStore(name: string, phone: string): Promise<void> {
  await logUser(name, phone);
  await logActivity("criar_utilizador", "utilizador", undefined, name, undefined, name);
}

// ─── ACTIVITY LOG (Histórico) ────────────────────────────────────────

export async function logActivity(
  action: string,
  entityType: string,
  entityId?: string,
  entityName?: string,
  userEmail?: string,
  userName?: string,
  details?: string,
): Promise<void> {
  try {
    await createActivityLog({
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      user_email: userEmail || auth?.currentUser?.email || undefined,
      user_name: userName || auth?.currentUser?.displayName || undefined,
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
