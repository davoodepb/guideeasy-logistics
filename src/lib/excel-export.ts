import * as XLSX from "xlsx";
import type { Checklist } from "./firebase";

export function exportChecklistToExcel(c: Checklist) {
  const wb = XLSX.utils.book_new();

  const meta = [
    ["Código AT", c.codigo_at],
    ["Estado", c.status],
    ["Criada em", new Date(c.created_at).toLocaleString("pt-PT")],
    ["Responsável", c.responsavel || ""],
    ["Submetida em", c.submitted_at ? new Date(c.submitted_at).toLocaleString("pt-PT") : ""],
    ["Observações do Renato", c.observacoes_renato || ""],
    ["Observações do Colaborador", c.observacoes_colaborador || ""],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Resumo");

  const rows = [
    ["Artigo", "Descrição", "Quantidade", "Unidade", "Confirmado"],
    ...c.items.map((i) => [
      i.artigo,
      i.descricao,
      i.quantidade,
      i.unidade,
      i.checked ? "Sim" : "Não",
    ]),
  ];
  const wsItems = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, wsItems, "Artigos");

  XLSX.writeFile(wb, `checklist_${c.codigo_at || c.id}.xlsx`);
}
