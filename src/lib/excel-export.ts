import * as XLSX from "xlsx";
import type { Checklist } from "./firebase";

/** Professional Excel export with multiple sheets, styling, summaries */
export function exportChecklistToExcel(c: Checklist) {
  const wb = XLSX.utils.book_new();
  const pdf = c.pdf_metadata || {};
  const now = new Date();
  const timestamp = now.toLocaleString("pt-PT");

  // ═══════════════════════════════════════════
  // SHEET 1: ARTIGOS (Main table)
  // ═══════════════════════════════════════════
  const headerRow = ["Data", "Artigo", "Chave AT", "Descrição", "Quantidade", "Unidade", "Confirmado", "Observações", "Assinatura"];
  const dataRows = c.items.map((i) => [
    c.data_documento || "",
    i.artigo,
    c.codigo_at || "",
    i.descricao,
    i.quantidade,
    i.unidade,
    i.checked ? "✓ Sim" : "Não",
    c.observacoes_renato || "",
    "",
  ]);

  const wsItems = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

  // Column widths
  wsItems["!cols"] = [
    { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 60 },
    { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 18 },
  ];

  // Auto-filter
  wsItems["!autofilter"] = { ref: `A1:I${dataRows.length + 1}` };

  // Freeze header row
  wsItems["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };

  // Style headers
  for (let col = 0; col < headerRow.length; col++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c: col });
    if (wsItems[cell]) {
      wsItems[cell].s = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        fill: { fgColor: { rgb: "0A2540" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          bottom: { style: "medium", color: { rgb: "4CAF50" } },
        },
      };
    }
  }

  // Style data rows with alternating colors
  for (let row = 0; row < dataRows.length; row++) {
    for (let col = 0; col < headerRow.length; col++) {
      const cell = XLSX.utils.encode_cell({ r: row + 1, c: col });
      if (wsItems[cell]) {
        wsItems[cell].s = {
          fill: { fgColor: { rgb: row % 2 === 0 ? "F8FAFC" : "FFFFFF" } },
          alignment: { vertical: "center", wrapText: col === 3 },
          border: {
            bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          },
        };
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, wsItems, "Artigos");

  // ═══════════════════════════════════════════
  // SHEET 2: RESUMO (Summary)
  // ═══════════════════════════════════════════
  const totalQty = c.items.reduce((sum, i) => {
    const n = parseFloat(i.quantidade.replace(",", "."));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const confirmed = c.items.filter((i) => i.checked).length;
  const units = [...new Set(c.items.map((i) => i.unidade))];

  const resumo = [
    ["RESUMO DO DOCUMENTO", ""],
    ["", ""],
    ["Informação Geral", ""],
    ["Data do Documento", c.data_documento || "—"],
    ["Nº Guia de Transporte", c.numero_guia || "—"],
    ["Chave AT", c.codigo_at || "—"],
    ["ATCUD", pdf.atcud || "—"],
    ["Tipo de Documento", pdf.tipo_documento || "—"],
    ["V/N.º Contribuinte", pdf.vn_contrib || "—"],
    ["Estado", c.status === "concluida" ? "✓ Concluída" : "⏳ Pendente"],
    ["", ""],
    ["Estatísticas", ""],
    ["Total de Artigos", String(c.items.length)],
    ["Artigos Confirmados", `${confirmed} / ${c.items.length}`],
    ["Quantidade Total", totalQty.toFixed(2)],
    ["Unidades Utilizadas", units.join(", ")],
    ["", ""],
    ["Emissor", ""],
    ["Empresa", pdf.emissor_empresa || "—"],
    ["Contribuinte", pdf.emissor_contribuinte || "—"],
    ["Morada", pdf.emissor_morada || "—"],
    ["Contactos", pdf.emissor_contactos || "—"],
    ["Capital Social", pdf.emissor_capital_social || "—"],
    ["", ""],
    ["Destinatário", ""],
    ["Nome", pdf.destinatario_nome || "—"],
    ["Morada", pdf.destinatario_morada || "—"],
    ["", ""],
    ["Transporte", ""],
    ["Data de Carga", c.data_carga || "—"],
    ["Hora de Carga", c.hora_carga || "—"],
    ["Local de Carga", pdf.carga_local || "—"],
    ["Local de Descarga", pdf.descarga_local || "—"],
    ["Morada de Descarga", pdf.descarga_morada || "—"],
    ["Disponibilização", pdf.disponibilizacao || "—"],
    ["Certificação", pdf.certificacao || "—"],
    ["", ""],
    ["Observações", ""],
    ["Observações do Renato", c.observacoes_renato || "—"],
    ["Observações do Colaborador", c.observacoes_colaborador || "—"],
    ["Responsável", c.responsavel || "—"],
    ["", ""],
    ["Processamento", ""],
    ["Data/Hora de Exportação", timestamp],
    ["Criada em", new Date(c.created_at).toLocaleString("pt-PT")],
    ["Submetida em", c.submitted_at ? new Date(c.submitted_at).toLocaleString("pt-PT") : "—"],
  ];

  const wsMeta = XLSX.utils.aoa_to_sheet(resumo);
  wsMeta["!cols"] = [{ wch: 30 }, { wch: 60 }];

  // Style section headers
  for (let rIdx = 0; rIdx < resumo.length; rIdx++) {
    const labelCell = XLSX.utils.encode_cell({ r: rIdx, c: 0 });
    const valueCell = XLSX.utils.encode_cell({ r: rIdx, c: 1 });

    // Title row
    if (rIdx === 0 && wsMeta[labelCell]) {
      wsMeta[labelCell].s = {
        font: { bold: true, sz: 16, color: { rgb: "0A2540" } },
      };
    }
    // Section headers (rows with label but no value)
    else if (resumo[rIdx][0] && !resumo[rIdx][1] && wsMeta[labelCell]) {
      wsMeta[labelCell].s = {
        font: { bold: true, sz: 12, color: { rgb: "0A2540" } },
        fill: { fgColor: { rgb: "EFF6FF" } },
        border: { bottom: { style: "thin", color: { rgb: "3B82F6" } } },
      };
    }
    // Value cells
    if (wsMeta[valueCell]) {
      wsMeta[valueCell].s = { alignment: { wrapText: true, vertical: "top" } };
    }
  }

  XLSX.utils.book_append_sheet(wb, wsMeta, "Resumo");

  // ═══════════════════════════════════════════
  // SHEET 3: LOG DE PROCESSAMENTO
  // ═══════════════════════════════════════════
  const logData = [
    ["LOG DE PROCESSAMENTO", "", ""],
    ["", "", ""],
    ["Data/Hora", "Evento", "Detalhes"],
    [timestamp, "Exportação Excel", `${c.items.length} artigos exportados`],
    [timestamp, "Documento", c.numero_guia || c.codigo_at || "N/A"],
    [timestamp, "Chave AT", c.codigo_at || "Não disponível"],
    [timestamp, "Quantidade Total", totalQty.toFixed(2)],
    [timestamp, "Estado", c.status],
  ];

  const wsLog = XLSX.utils.aoa_to_sheet(logData);
  wsLog["!cols"] = [{ wch: 22 }, { wch: 25 }, { wch: 50 }];

  if (wsLog["A1"]) {
    wsLog["A1"].s = { font: { bold: true, sz: 14, color: { rgb: "0A2540" } } };
  }
  for (let col = 0; col < 3; col++) {
    const cell = XLSX.utils.encode_cell({ r: 2, c: col });
    if (wsLog[cell]) {
      wsLog[cell].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "475569" } },
      };
    }
  }

  XLSX.utils.book_append_sheet(wb, wsLog, "Log");

  // Generate filename
  const dateStr = (c.data_documento || "").replace(/-/g, "");
  const fname = `GuiaTransporte_${c.numero_guia?.replace(/[/\\]/g, "-") || c.codigo_at || c.id}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fname);
}
