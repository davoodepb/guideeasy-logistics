// PDF extractor for "Guia de Transporte" PDFs.
// Extracts ALL important fields from the Prudêncio transport guide.

import type { ChecklistItem } from "./firebase";

/** Dados do emissor / remetente */
export type EmissorData = {
  empresa: string;
  contribuinte: string;
  morada: string;
  contactos: string;
  capital_social: string;
};

/** Dados do destinatário */
export type DestinatarioData = {
  nome: string;
  morada: string;
};

/** Dados de transporte */
export type TransporteData = {
  carga_local: string;
  carga_data: string;
  carga_hora: string;
  descarga_local: string;
  descarga_morada: string;
  disponibilizacao: string;
  certificacao: string;
};

export type ExtractedData = {
  // Documento
  chave_at: string;
  atcud: string;
  numero_guia: string;
  tipo_documento: string;
  data_documento: string;
  vn_contrib: string;

  // Datas de transporte
  data_carga: string;
  hora_carga: string;

  // Emissor
  emissor: EmissorData;

  // Destinatário
  destinatario: DestinatarioData;

  // Transporte
  transporte: TransporteData;

  // Artigos
  items: ChecklistItem[];
};

export async function extractFromPdf(file: File): Promise<ExtractedData> {
  // Dynamic import so pdfjs only loads in the browser.
  const pdfjs = await import("pdfjs-dist");
  // Use the bundled worker via Vite ?url
  const workerMod = (await import(
    /* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min.mjs?url"
  )) as { default: string };
  const workerUrl = workerMod.default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;

  // Build a list of text items WITH their geometry so we can group by line and column.
  type Tok = { str: string; x: number; y: number; w: number };
  const tokens: Tok[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items as any[]) {
      const t = it.transform; // [a,b,c,d,e,f] -> e=x, f=y
      tokens.push({ str: it.str, x: t[4], y: t[5], w: it.width });
    }
  }

  // Reconstruct full text for regex extraction
  const fullText = tokens.map((t) => t.str).join(" ");

  // ──────────────────────────────────────────
  // DOCUMENT INFO
  // ──────────────────────────────────────────

  // Chave AT
  const chaveMatch = fullText.match(/Chave\s*AT[:\s]*([A-Z0-9]+)/i);
  const chave_at = chaveMatch ? chaveMatch[1] : "";

  // ATCUD
  const atcudMatch = fullText.match(/ATCUD[:\s]*([A-Z0-9\-]+)/i);
  const atcud = atcudMatch ? atcudMatch[1] : "";

  // Número da guia (ex: GT GT.2026/67)
  const guiaMatch =
    fullText.match(/GT\s*GT\.?(\d{4}\/\d+)/i) || fullText.match(/GT\.?(\d{4}\/\d+)/i);
  const numero_guia = guiaMatch ? `GT.${guiaMatch[1]}` : "";

  // Tipo de documento
  const tipoMatch = fullText.match(/Guia\s+de\s+[Tt]ransporte/i);
  const tipo_documento = tipoMatch ? "Guia de Transporte" : "";

  // Data do documento — primeira data ISO encontrada após "Data"
  const dataDocMatch = fullText.match(/Data[^0-9]{0,30}(\d{4}-\d{2}-\d{2})/i);
  const data_documento = dataDocMatch ? dataDocMatch[1] : "";

  // V/N.º Contrib.
  const vnContribMatch = fullText.match(/V\/N\.?\s*º?\s*Contrib\.?\s*[:\s]*(\d{6,})/i);
  const vn_contrib = vnContribMatch ? vnContribMatch[1] : "";

  // ──────────────────────────────────────────
  // EMISSOR DATA
  // ──────────────────────────────────────────

  // Empresa
  let empresa = "";
  const empresaMatch = fullText.match(/J\.\s*PRUD[EÊ]NCIO[,\s]*LDA/i);
  if (empresaMatch) empresa = "J. PRUDÊNCIO, LDA";

  // Contribuinte emissor
  const contribMatch = fullText.match(/Contribuinte\s*N\.?\s*º?\s*[:\s]*(\d{9})/i);
  const contribuinte = contribMatch ? contribMatch[1] : "";

  // Morada emissor
  let morada_emissor = "";
  const moradaMatch = fullText.match(/Parque\s+Industrial\s+de\s+Sete\s+Fontes/i);
  if (moradaMatch) {
    morada_emissor = "Parque Industrial de Sete Fontes, BRAGA, 4710-553 BRAGA";
  }

  // Contactos
  let contactos = "";
  const telMatch = fullText.match(/Telef\.?\s*(\d[\d\s]+)/i);
  if (telMatch) contactos = `Telef. ${telMatch[1].trim()}`;
  const emailMatch = fullText.match(/([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})/i);
  if (emailMatch) contactos += (contactos ? " / " : "") + emailMatch[1];

  // Capital Social
  let capital_social = "";
  const capitalMatch = fullText.match(/Capital\s+Social\s+([\d\s.,]+\s*EUR)/i);
  if (capitalMatch) capital_social = capitalMatch[1].trim();

  const emissor: EmissorData = {
    empresa: empresa || "Prudêncio Impermeabilizações",
    contribuinte,
    morada: morada_emissor,
    contactos,
    capital_social,
  };

  // ──────────────────────────────────────────
  // DESTINATÁRIO DATA
  // ──────────────────────────────────────────

  let dest_nome = "";
  let dest_morada = "";

  // Try to extract destinatário from "Exmo.(s) Sr.(s)" section
  const exmoIdx = fullText.indexOf("Exmo");
  if (exmoIdx >= 0) {
    // Find text after Exmo.(s) Sr.(s) until next section marker
    const afterExmo = fullText.substring(exmoIdx);
    // Look for address-like patterns
    const destLines = afterExmo.match(
      /(?:Exmo.*?Sr.*?\s+)([A-ZÀ-ÿ][A-Za-zÀ-ÿ\s,.\-0-9]+?)(?:\s+(?:Rua|Av\.|R\.|Travessa|Largo|Praça))/i,
    );
    if (destLines) dest_nome = destLines[1].trim();

    const ruaMatch = afterExmo.match(
      /((?:Rua|Av\.|R\.|Travessa|Largo|Praça)\s+[A-Za-zÀ-ÿ\s,.\-0-9]+?\d+)/i,
    );
    if (ruaMatch) dest_morada = ruaMatch[1].trim();
  }

  // Fallback: try "Condomínio" pattern
  if (!dest_nome) {
    const condMatch = fullText.match(/(Condom[ií]nio\s+[A-Za-zÀ-ÿ\s,.\-0-9]+?\d+)/i);
    if (condMatch) dest_nome = condMatch[1].trim();
  }

  // Try to find postal code for destinatário
  if (!dest_morada) {
    const postalMatches = [...fullText.matchAll(/(\d{4}-\d{3}\s+[A-Za-zÀ-ÿ]+)/gi)];
    if (postalMatches.length >= 2) {
      // Second postal code is likely the destinatário
      dest_morada = dest_nome ? `${dest_nome}, ${postalMatches[1][1]}` : postalMatches[1][1];
    }
  }

  const destinatario: DestinatarioData = {
    nome: dest_nome,
    morada: dest_morada,
  };

  // ──────────────────────────────────────────
  // TRANSPORT DATA
  // ──────────────────────────────────────────

  // Data + hora de carga
  const cargaMatch =
    fullText.match(
      /disposi[cç][aã]o\s+na\s+data\s+(\d{4}-\d{2}-\d{2})(?:\s*\/\s*(\d{1,2}:\d{2}))?/i,
    ) || fullText.match(/Carga[\s\S]{0,80}?(\d{4}-\d{2}-\d{2})(?:\s*\/\s*(\d{1,2}:\d{2}))?/i);
  const data_carga = cargaMatch ? cargaMatch[1] : "";
  const hora_carga = cargaMatch && cargaMatch[2] ? cargaMatch[2] : "";

  // Carga local
  let carga_local = "";
  const cargaLocalMatch = fullText.match(
    /Carga.*?(?:N\/\s*Morada|Morada)[^A-Z]*([A-Za-zÀ-ÿ\s]+(?:de\s+)?[A-Za-zÀ-ÿ\s]+)/i,
  );
  if (cargaLocalMatch) {
    carga_local = cargaLocalMatch[1].trim();
  }
  if (!carga_local && morada_emissor) carga_local = morada_emissor;

  // Descarga local
  let descarga_local = "";
  const descargaMatch = fullText.match(
    /Descarga.*?(?:V\/\s*Morada|Morada)[^A-Z]*([A-Za-zÀ-ÿ\s,.\-0-9]+)/i,
  );
  if (descargaMatch) descarga_local = descargaMatch[1].trim();

  // Disponibilização
  let disponibilizacao = "";
  const dispMatch = fullText.match(
    /colocados\s+[àa]\s+disposi[çc][ãa]o\s+na\s+data\s+(\d{4}-\d{2}-\d{2})/i,
  );
  if (dispMatch) disponibilizacao = dispMatch[1];

  // Certificação
  let certificacao = "";
  const certMatch = fullText.match(
    /Processado\s+por\s+Programa\s+Certificado\s+n\.?\s*º?\s*([^\n(]+)/i,
  );
  if (certMatch) certificacao = certMatch[1].trim();

  const transporte: TransporteData = {
    carga_local,
    carga_data: data_carga,
    carga_hora: hora_carga,
    descarga_local,
    descarga_morada: dest_morada,
    disponibilizacao,
    certificacao,
  };

  // ──────────────────────────────────────────
  // ARTIGOS (TABLE ITEMS)
  // ──────────────────────────────────────────

  const unitSet = new Set(["M2", "M3", "ML", "UN", "KG", "LT", "L", "PC", "CX", "SC", "UND"]);
  const stopLineTokens = [
    "este documento",
    "processado por",
    "carga",
    "descarga",
    "atcud",
    "total",
    "totais",
    "iva",
    "observa",
    "pagamento",
    "rodape",
    "rodapé",
  ];

  const headerNoiseTokens = ["artigo", "descri", "qtd", "quant", "un.", "un "];

  const isForbiddenArtigo = (code: string, lineLower: string) => {
    if (code === vn_contrib || code === contribuinte) return true;
    if (/^\d{4}-\d{2}-\d{2}$/.test(code)) return true;
    if (lineLower.includes("contrib") || lineLower.includes("nif") || lineLower.includes("vat"))
      return true;
    if (lineLower.includes("cliente") || lineLower.includes("telefone")) return true;
    if (lineLower.includes("codigo postal") || lineLower.includes("código postal")) return true;
    return false;
  };

  // Group tokens into lines by Y coordinate (tolerance 5pt)
  const lines = new Map<number, Tok[]>();
  for (const t of tokens) {
    const key = Math.round(t.y / 5) * 5;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key)!.push(t);
  }
  const sortedLines = [...lines.entries()]
    .sort((a, b) => b[0] - a[0]) // top of page first
    .map(([, toks]) => toks.sort((a, b) => a.x - b.x));

  // Find the header line containing "Artigo" "Descrição" "Qtd" "Un"
  let headerIdx = -1;
  let xArtigo = 0,
    xDesc = 0,
    xQtd = 0,
    xUn = 0;
  for (let i = 0; i < sortedLines.length; i++) {
    const joined = sortedLines[i]
      .map((t) => t.str)
      .join(" ")
      .toLowerCase();
    if (
      joined.includes("artigo") &&
      joined.includes("descri") &&
      (joined.includes("qtd") || joined.includes("quant"))
    ) {
      headerIdx = i;
      for (const t of sortedLines[i]) {
        const s = t.str.toLowerCase();
        if (s.startsWith("artigo")) xArtigo = t.x;
        else if (s.startsWith("descri")) xDesc = t.x;
        else if (s.startsWith("qtd") || s.startsWith("quant")) xQtd = t.x;
        else if (s === "un." || s === "un" || s.startsWith("un")) xUn = t.x;
      }
      break;
    }
  }

  if (headerIdx >= 0 && (!xArtigo || !xDesc || !xQtd || !xUn)) {
    headerIdx = -1;
  }

  const items: ChecklistItem[] = [];
  const seen = new Set<string>();
  if (headerIdx >= 0) {
    // Iterate lines after the header until a footer / blank section.
    for (let i = headerIdx + 1; i < sortedLines.length; i++) {
      const line = sortedLines[i];
      if (!line.length) continue;
      const text = line.map((t) => t.str).join(" ");
      const lower = text.toLowerCase();

      // Stop conditions: footer markers
      if (stopLineTokens.some((t) => lower.includes(t)))
        break;

      // An item line starts with a numeric "artigo" code (>=6 digits typically)
      const first = line[0].str.trim();
      if (!/^\d{4,}$/.test(first)) continue;
      if (isForbiddenArtigo(first, lower)) continue;

      // Bucket tokens by X into columns
      const artigo = first;
      let descricao = "";
      let qtd = "";
      let un = "";
      for (const t of line.slice(1)) {
        if (xUn && t.x >= xUn - 5) un += t.str;
        else if (xQtd && t.x >= xQtd - 30) qtd += t.str;
        else descricao += (descricao ? " " : "") + t.str;
      }

      const desc = descricao.trim();
      const qty = qtd.trim();
      const unit = un.trim().toUpperCase();
      const qtyOk = /^\d{1,5}(?:[.,]\d{1,3})?$/.test(qty);
      const unitOk = unitSet.has(unit);
      const descOk = desc.length > 2 && !headerNoiseTokens.some((t) => desc.toLowerCase().includes(t));
      if (!qtyOk || !unitOk || !descOk) continue;

      const dedupeKey = `${artigo}|${qty}|${unit}|${desc}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      items.push({
        artigo,
        descricao: desc,
        quantidade: qty,
        unidade: unit,
        checked: false,
      });
    }
  }

  // Fallback: se nada foi detetado por colunas, usa regex no texto plano
  if (items.length === 0) {
    const lineRegex =
      /(\d{6,})\s+((?:(?!\d{6,})[A-Za-zÀ-ÿ0-9.,\-/()\s])+?)\s+(\d{1,3}(?:[.,]\d{1,3})?)\s+(M2|M3|ML|UN|KG|LT|L|PC|CX|SC|UND)\b/gi;
    let m: RegExpExecArray | null;
    while ((m = lineRegex.exec(fullText)) !== null) {
      const lineLower = m[0].toLowerCase();
      if (isForbiddenArtigo(m[1], lineLower)) continue;

      const desc = m[2].replace(/\s+/g, " ").trim();
      const qty = m[3];
      const unit = m[4].toUpperCase();
      const qtyOk = /^\d{1,5}(?:[.,]\d{1,3})?$/.test(qty);
      const unitOk = unitSet.has(unit);
      const descOk = desc.length > 2 && !headerNoiseTokens.some((t) => desc.toLowerCase().includes(t));
      if (!qtyOk || !unitOk || !descOk) continue;

      const dedupeKey = `${m[1]}|${qty}|${unit}|${desc}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      items.push({
        artigo: m[1],
        descricao: desc,
        quantidade: qty,
        unidade: unit,
        checked: false,
      });
    }
  }

  return {
    chave_at,
    atcud,
    numero_guia,
    tipo_documento,
    data_documento,
    vn_contrib,
    data_carga,
    hora_carga,
    emissor,
    destinatario,
    transporte,
    items,
  };
}
