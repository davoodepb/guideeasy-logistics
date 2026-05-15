import * as XLSX from "xlsx";
import type { Checklist } from "./firebase";

export function exportChecklistToExcel(c: Checklist) {
  const wb = XLSX.utils.book_new();

  const meta = [
    ["Data do Documento", c.data_documento || ""],
    ["Chave AT", c.codigo_at || ""],
    ["Guia de Transporte", c.numero_guia || ""],
    ["Data de Carga", c.data_carga || ""],
    ["Hora de Carga", c.hora_carga || ""],
    ["Estado", c.status],
    ["Progresso", `${c.items.filter((i) => i.checked).length} / ${c.items.length}`],
    ["Criada em", new Date(c.created_at).toLocaleString("pt-PT")],
    ["Responsável", c.responsavel || ""],
    ["Submetida em", c.submitted_at ? new Date(c.submitted_at).toLocaleString("pt-PT") : ""],
    ["Observações do Renato", c.observacoes_renato || ""],
    ["Observações do Colaborador", c.observacoes_colaborador || ""],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  wsMeta["!cols"] = [{ wch: 30 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, "Resumo");

  const rows = [
    ["Data", "Artigo", "Chave AT", "Descrição", "Quantidade", "Unidade"],
    ...c.items.map((i) => [
      c.data_documento || "",
      i.artigo,
      c.codigo_at || "",
      i.descricao,
      i.quantidade,
      i.unidade,
    ]),
  ];
  const wsItems = XLSX.utils.aoa_to_sheet(rows);
  wsItems["!cols"] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
    { wch: 70 },
    { wch: 12 },
    { wch: 10 },
  ];
  wsItems["!autofilter"] = { ref: "A1:F1" };

  for (let cIdx = 0; cIdx < 6; cIdx++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c: cIdx });
    if (wsItems[cell]) {
      wsItems[cell].s = { font: { bold: true } };
    }
  }
  XLSX.utils.book_append_sheet(wb, wsItems, "Artigos");

  XLSX.writeFile(wb, `checklist_${c.codigo_at || c.id}.xlsx`);
}
