// Camada de persistência: Supabase (primário) + Firebase RTDB (best-effort).
import { supabase } from "@/integrations/supabase/client";
import {
  createChecklist as fbCreate,
  updateChecklist as fbUpdate,
  logUser as fbLogUser,
  type Checklist,
  type ChecklistItem,
  type PdfMetadata,
} from "./firebase";

export type { Checklist, ChecklistItem, PdfMetadata };

export async function createChecklistStore(c: Omit<Checklist, "id">): Promise<string> {
  // Supabase primário
  const { data: row, error } = await supabase
    .from("checklists")
    .insert({
      codigo_at: c.codigo_at || null,
      numero_guia: c.numero_guia || null,
      data_documento: c.data_documento || null,
      data_carga: c.data_carga || null,
      hora_carga: c.hora_carga || null,
      observacoes_renato: c.observacoes_renato || null,
      status: c.status,
      created_by: c.created_by || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = row.id as string;

  if (c.items?.length) {
    const payload = c.items.map((it, idx) => ({
      checklist_id: id,
      artigo: it.artigo,
      descricao: it.descricao,
      quantidade: it.quantidade,
      unidade: it.unidade,
      checked: !!it.checked,
      position: idx,
    }));
    const { error: e2 } = await supabase.from("checklist_items").insert(payload);
    if (e2) throw e2;
  }

  // Espelha no Firebase (não bloqueia) — inclui pdf_metadata
  fbCreate({ ...c }).catch((e) => console.warn("Firebase mirror falhou:", e));
  return id;
}

export async function getChecklistStore(id: string): Promise<Checklist | null> {
  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const { data: items } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("checklist_id", id)
    .order("position", { ascending: true });
  return rowToChecklist(data, items ?? []);
}

export async function listChecklistsStore(): Promise<Checklist[]> {
  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => rowToChecklist(r, []));
}

export async function updateChecklistStore(id: string, patch: Partial<Checklist>) {
  const update: {
    status?: string;
    responsavel?: string | null;
    observacoes_colaborador?: string | null;
    observacoes_renato?: string | null;
    submitted_at?: string | null;
  } = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.responsavel !== undefined) update.responsavel = patch.responsavel ?? null;
  if (patch.observacoes_colaborador !== undefined)
    update.observacoes_colaborador = patch.observacoes_colaborador ?? null;
  if (patch.observacoes_renato !== undefined)
    update.observacoes_renato = patch.observacoes_renato ?? null;
  if (patch.submitted_at !== undefined)
    update.submitted_at = patch.submitted_at ? new Date(patch.submitted_at).toISOString() : null;

  if (Object.keys(update).length) {
    const { error } = await supabase.from("checklists").update(update).eq("id", id);
    if (error) throw error;
  }

  if (patch.items) {
    // Atualiza estado checked de cada item por posição/artigo
    for (let i = 0; i < patch.items.length; i++) {
      const it = patch.items[i];
      await supabase
        .from("checklist_items")
        .update({ checked: !!it.checked })
        .eq("checklist_id", id)
        .eq("position", i);
    }
  }

  fbUpdate(id, patch).catch(() => {});
}

export async function logUserStore(name: string, phone: string) {
  await supabase.from("app_users").insert({ name, phone }).then(
    () => {},
    (e) => console.warn("app_users insert falhou:", e),
  );
  fbLogUser(name, phone).catch(() => {});
}

function rowToChecklist(r: Record<string, any>, items: any[]): Checklist {
  return {
    id: r.id,
    codigo_at: r.codigo_at ?? "",
    numero_guia: r.numero_guia ?? "",
    data_documento: r.data_documento ?? "",
    data_carga: r.data_carga ?? "",
    hora_carga: r.hora_carga ?? "",
    observacoes_renato: r.observacoes_renato ?? "",
    status: (r.status as "pendente" | "concluida") ?? "pendente",
    created_at: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    created_by: r.created_by ?? undefined,
    responsavel: r.responsavel ?? undefined,
    observacoes_colaborador: r.observacoes_colaborador ?? undefined,
    submitted_at: r.submitted_at ? new Date(r.submitted_at).getTime() : undefined,
    items: items.map((it) => ({
      artigo: it.artigo ?? "",
      descricao: it.descricao ?? "",
      quantidade: it.quantidade ?? "",
      unidade: it.unidade ?? "",
      checked: !!it.checked,
    })),
  };
}
