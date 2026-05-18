// Supabase Wake + Auto-Sync
// Quando alguém abre a app e o Supabase está de volta (após estar em pausa),
// copia automaticamente todas as guias do Firebase para o Supabase.
// O utilizador não precisa de fazer nada — é 100 % automático.

import { supabase } from "@/integrations/supabase/client";
import {
  listChecklists as fbList,
  db as fbDb,
  type Checklist,
} from "./firebase";

const SYNC_FLAG = "supabase_needs_sync";
const LAST_SYNC_KEY = "supabase_last_sync";

// ─── Verificar se o Supabase está acessível ─────────────────────────

async function pingSupabase(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const { error } = await supabase
      .from("checklists")
      .select("id", { count: "exact", head: true })
      .abortSignal(controller.signal)
      .limit(1);
    clearTimeout(timer);
    return !error;
  } catch {
    return false;
  }
}

// ─── Marcar que precisamos sincronizar ──────────────────────────────

function markNeedsSync() {
  try {
    localStorage.setItem(SYNC_FLAG, "true");
  } catch {}
}

function clearSyncFlag() {
  try {
    localStorage.removeItem(SYNC_FLAG);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {}
}

function needsSync(): boolean {
  try {
    return localStorage.getItem(SYNC_FLAG) === "true";
  } catch {
    return false;
  }
}

// ─── Sincronizar Firebase → Supabase ────────────────────────────────

async function syncFirebaseToSupabase(): Promise<void> {
  console.info("[sync] A iniciar sincronização Firebase → Supabase...");

  let fbChecklists: Checklist[];
  try {
    fbChecklists = await fbList();
  } catch (err) {
    console.warn("[sync] Não consegui ler checklists do Firebase:", err);
    return;
  }

  if (!fbChecklists.length) {
    console.info("[sync] Nenhuma checklist no Firebase para sincronizar.");
    clearSyncFlag();
    return;
  }

  // Obter IDs já existentes no Supabase para evitar duplicados
  const { data: existing } = await supabase
    .from("checklists")
    .select("codigo_at, numero_guia");
  const existingKeys = new Set(
    (existing ?? []).map(
      (r) => `${r.codigo_at ?? ""}|${r.numero_guia ?? ""}`,
    ),
  );

  let synced = 0;
  let skipped = 0;

  for (const c of fbChecklists) {
    const key = `${c.codigo_at ?? ""}|${c.numero_guia ?? ""}`;

    // Se já existe no Supabase (pelo par codigo_at + numero_guia), salta
    if (existingKeys.has(key) && key !== "|") {
      skipped++;
      continue;
    }

    try {
      // Inserir checklist
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
          responsavel: c.responsavel || null,
          observacoes_colaborador: c.observacoes_colaborador || null,
          submitted_at: c.submitted_at
            ? new Date(c.submitted_at).toISOString()
            : null,
        })
        .select("id")
        .single();

      if (error) {
        console.warn(`[sync] Erro ao inserir checklist ${key}:`, error);
        continue;
      }

      const newId = row.id as string;

      // Inserir items
      if (c.items?.length) {
        const payload = c.items.map((it, idx) => ({
          checklist_id: newId,
          artigo: it.artigo,
          descricao: it.descricao,
          quantidade: it.quantidade,
          unidade: it.unidade,
          checked: !!it.checked,
          position: idx,
        }));
        await supabase.from("checklist_items").insert(payload);
      }

      synced++;
    } catch (err) {
      console.warn(`[sync] Erro inesperado ao sincronizar ${key}:`, err);
    }
  }

  console.info(
    `[sync] Sincronização concluída: ${synced} adicionadas, ${skipped} já existiam.`,
  );
  clearSyncFlag();
}

// ─── Ponto de entrada — chamar uma vez no arranque da app ───────────

let _initialized = false;

export async function initSupabaseWake(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  if (typeof window === "undefined") return;

  const supabaseUp = await pingSupabase();

  if (!supabaseUp) {
    // Supabase em pausa — marcar para sincronizar quando voltar
    markNeedsSync();
    console.info(
      "[sync] Supabase indisponível. Marcado para sincronizar quando voltar.",
    );
    return;
  }

  // Supabase está ativo
  if (needsSync()) {
    // Havia uma nota de "preciso sincronizar" — vamos fazer isso agora
    try {
      await syncFirebaseToSupabase();
    } catch (err) {
      console.warn("[sync] Erro durante sincronização:", err);
    }
  }
}
