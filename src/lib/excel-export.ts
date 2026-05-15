import * as XLSX from "xlsx";
import type { Checklist } from "./firebase";

export function exportChecklistToExcel(c: Checklist) {
  const wb = XLSX.utils.book_new();

  const pdf = c.pdf_metadata || {};

  const meta = [
    ["Resumo", ""],
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
    ["", ""],
    ["Emissor", ""],
    ["Empresa", pdf.emissor_empresa || ""],
    ["Contribuinte", pdf.emissor_contribuinte || ""],
    ["Morada", pdf.emissor_morada || ""],
    ["Contactos", pdf.emissor_contactos || ""],
    ["Capital Social", pdf.emissor_capital_social || ""],
    ["", ""],
    ["Destinatário", ""],
    ["Nome", pdf.destinatario_nome || ""],
    ["Morada", pdf.destinatario_morada || ""],
    ["", ""],
    ["Documento", ""],
    ["Tipo de Documento", pdf.tipo_documento || ""],
    ["ATCUD", pdf.atcud || ""],
    ["V/N Contrib.", pdf.vn_contrib || ""],
    ["Certificação", pdf.certificacao || ""],
    ["Disponibilização", pdf.disponibilizacao || ""],
    ["", ""],
    ["Carga/Descarga", ""],
    ["Local de Carga", pdf.carga_local || ""],
    ["Local de Descarga", pdf.descarga_local || ""],
    ["Morada de Descarga", pdf.descarga_morada || ""],
    ["", ""],
    ["Observações e Assinaturas", ""],
    ["Observações do Renato", c.observacoes_renato || ""],
    ["Observações do Colaborador", c.observacoes_colaborador || ""],
    ["Assinatura do Renato", ""],
    ["Data de Assinatura", ""],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  wsMeta["!cols"] = [{ wch: 36 }, { wch: 80 }];

  for (let rIdx = 0; rIdx < meta.length; rIdx++) {
    const labelCell = XLSX.utils.encode_cell({ r: rIdx, c: 0 });
    const valueCell = XLSX.utils.encode_cell({ r: rIdx, c: 1 });
    if (wsMeta[valueCell]) {
      wsMeta[valueCell].s = { alignment: { wrapText: true, vertical: "top" } };
    }
    if (meta[rIdx][0] && !meta[rIdx][1] && wsMeta[labelCell]) {
      wsMeta[labelCell].s = { font: { bold: true } };
    }
  }
  XLSX.utils.book_append_sheet(wb, wsMeta, "Resumo");

  const rows = [
    [
      "Data",
      "Artigo",
      "Chave AT",
      "Descrição",
      "Quantidade",
      "Unidade",
      "Observações do Renato",
      "Assinatura",
      "Data de Assinatura",
    ],
    ...c.items.map((i) => [
      c.data_documento || "",
      i.artigo,
      c.codigo_at || "",
      i.descricao,
      i.quantidade,
      i.unidade,
      c.observacoes_renato || "",
      "",
      "",
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
    { wch: 35 },
    { wch: 20 },
    { wch: 18 },
  ];
  wsItems["!autofilter"] = { ref: "A1:I1" };

  for (let cIdx = 0; cIdx < 9; cIdx++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c: cIdx });
    if (wsItems[cell]) {
      wsItems[cell].s = { font: { bold: true } };
    }
  }
  XLSX.utils.book_append_sheet(wb, wsItems, "Artigos");

  XLSX.writeFile(wb, `checklist_${c.codigo_at || c.id}.xlsx`);
}
