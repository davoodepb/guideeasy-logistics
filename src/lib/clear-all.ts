// clear-all.ts — Apaga TUDO: checklists, items, app_users (Supabase + Firebase).
// Base de dados fica como no primeiro dia.
import { supabase } from "@/integrations/supabase/client";
import { db as fbDb } from "./firebase";

export type ClearResult = {
  checklists: number;
  items: number;
  users: number;
  firebaseCleaned: boolean;
};

/**
 * Apaga todos os dados de ambas as bases de dados.
 * Retorna um resumo do que foi apagado.
 */
export async function clearAllData(): Promise<ClearResult> {
  const result: ClearResult = {
    checklists: 0,
    items: 0,
    users: 0,
    firebaseCleaned: false,
  };

  // ─── 1. Contar antes de apagar (para o resumo) ────────────────────
  try {
    const { count: itemCount } = await supabase
      .from("checklist_items")
      .select("*", { count: "exact", head: true });
    result.items = itemCount ?? 0;
  } catch {}

  try {
    const { count: checklistCount } = await supabase
      .from("checklists")
      .select("*", { count: "exact", head: true });
    result.checklists = checklistCount ?? 0;
  } catch {}

  try {
    const { count: userCount } = await supabase
      .from("app_users")
      .select("*", { count: "exact", head: true });
    result.users = userCount ?? 0;
  } catch {}

  // ─── 2. Apagar no Supabase (ordem: items → checklists → users) ───
  try {
    // Apagar todos os items primeiro (foreign key)
    await supabase.from("checklist_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    // Apagar todas as checklists
    await supabase.from("checklists").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    // Apagar todos os utilizadores
    await supabase.from("app_users").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  } catch (err) {
    console.warn("[clear-all] Erro ao apagar no Supabase:", err);
  }

  // ─── 3. Apagar tudo no Firebase ───────────────────────────────────
  try {
    const { ref, remove } = await import("firebase/database");
    await remove(ref(fbDb, "checklists"));
    await remove(ref(fbDb, "users"));
    result.firebaseCleaned = true;
  } catch (err) {
    console.warn("[clear-all] Erro ao limpar Firebase:", err);
  }

  // ─── 4. Limpar flag de sync ───────────────────────────────────────
  try {
    localStorage.removeItem("supabase_needs_sync");
  } catch {}

  console.info(
    `[clear-all] Concluído: ${result.checklists} checklists, ${result.items} items, ${result.users} users apagados. Firebase: ${result.firebaseCleaned ? "limpo" : "erro"}`,
  );

  return result;
}
