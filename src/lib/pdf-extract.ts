// PDF extractor for "Guia de Transporte" PDFs.
// Advanced extraction with visual table detection, NIF filtering, and contextual validation.

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

/** Validation log entry */
export type ValidationEntry = {
  field: string;
  status: "ok" | "warning" | "error";
  message: string;
};

export type ExtractedData = {
  chave_at: string;
  atcud: string;
  numero_guia: string;
  tipo_documento: string;
  data_documento: string;
  vn_contrib: string;
  data_carga: string;
  hora_carga: string;
  emissor: EmissorData;
  destinatario: DestinatarioData;
  transporte: TransporteData;
  items: ChecklistItem[];
  // QR Code data
  qr_at_code: string;
  qr_raw: string;
  qr_confidence: number;
  // Validation
  validations: ValidationEntry[];
  processing_time: number;
};

// ─── Known NIF patterns to NEVER treat as artigo ───
const KNOWN_NIF_PATTERNS = [
  /^[125689]\d{8}$/, // Portuguese NIF format
  /^PT\d{9}$/i,      // VAT with PT prefix
];

// ─── Fiscal zone keywords — if nearby, code is NOT an artigo ───
const FISCAL_ZONE_KEYWORDS = [
  "contribuinte", "nif", "vat", "n.º contrib", "v/n", "cliente",
  "telefone", "telemóvel", "fax", "email", "código postal",
  "capital social", "conservatória", "matrícula", "certidão",
];

const UNIT_SET = new Set(["M2", "M3", "ML", "UN", "KG", "LT", "L", "PC", "CX", "SC", "UND", "MT", "M", "TON", "PAL"]);

const STOP_TOKENS = [
  "este documento", "processado por", "carga", "descarga", "atcud",
  "total", "totais", "iva", "observa", "pagamento", "rodape", "rodapé",
  "assinatura", "certificado", "software", "programa",
];

const HEADER_NOISE = ["artigo", "descri", "qtd", "quant", "un.", "un "];

export async function extractFromPdf(file: File): Promise<ExtractedData> {
  const startTime = Date.now();
  const validations: ValidationEntry[] = [];

  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import(
    /* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min.mjs?url"
  )) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;

  type Tok = { str: string; x: number; y: number; w: number; page: number };
  const tokens: Tok[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items as any[]) {
      const t = it.transform;
      tokens.push({ str: it.str, x: t[4], y: t[5], w: it.width, page: p });
    }
  }

  const fullText = tokens.map((t) => t.str).join(" ");

  // ──── DOCUMENT INFO ────
  const chaveMatch = fullText.match(/Chave\s*AT[:\s]*([A-Z0-9]+)/i);
  const chave_at = chaveMatch ? chaveMatch[1] : "";

  const atcudMatch = fullText.match(/ATCUD[:\s]*([A-Z0-9\-]+)/i);
  const atcud = atcudMatch ? atcudMatch[1] : "";

  const guiaMatch = fullText.match(/GT\s*GT\.?(\d{4}\/\d+)/i) || fullText.match(/GT\.?(\d{4}\/\d+)/i);
  const numero_guia = guiaMatch ? `GT.${guiaMatch[1]}` : "";

  const tipoMatch = fullText.match(/Guia\s+de\s+[Tt]ransporte/i);
  const tipo_documento = tipoMatch ? "Guia de Transporte" : "";

  const dataDocMatch = fullText.match(/Data[^0-9]{0,30}(\d{4}-\d{2}-\d{2})/i);
  const data_documento = dataDocMatch ? dataDocMatch[1] : "";

  const vnContribMatch = fullText.match(/V\/N\.?\s*º?\s*Contrib\.?\s*[:\s]*(\d{6,})/i);
  const vn_contrib = vnContribMatch ? vnContribMatch[1] : "";

  // ──── EMISSOR ────
  let empresa = "";
  const empresaMatch = fullText.match(/J\.\s*PRUD[EÊ]NCIO[,\s]*LDA/i);
  if (empresaMatch) empresa = "J. PRUDÊNCIO, LDA";

  const contribMatch = fullText.match(/Contribuinte\s*N\.?\s*º?\s*[:\s]*(\d{9})/i);
  const contribuinte = contribMatch ? contribMatch[1] : "";

  let morada_emissor = "";
  const moradaMatch = fullText.match(/Parque\s+Industrial\s+de\s+Sete\s+Fontes/i);
  if (moradaMatch) morada_emissor = "Parque Industrial de Sete Fontes, BRAGA, 4710-553 BRAGA";

  let contactos = "";
  const telMatch = fullText.match(/Telef\.?\s*(\d[\d\s]+)/i);
  if (telMatch) contactos = `Telef. ${telMatch[1].trim()}`;
  const emailMatch = fullText.match(/([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})/i);
  if (emailMatch) contactos += (contactos ? " / " : "") + emailMatch[1];

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

  // ──── DESTINATÁRIO ────
  let dest_nome = "";
  let dest_morada = "";

  const exmoIdx = fullText.indexOf("Exmo");
  if (exmoIdx >= 0) {
    const afterExmo = fullText.substring(exmoIdx);
    const destLines = afterExmo.match(
      /(?:Exmo.*?Sr.*?\s+)([A-ZÀ-ÿ][A-Za-zÀ-ÿ\s,.\-0-9]+?)(?:\s+(?:Rua|Av\.|R\.|Travessa|Largo|Praça))/i,
    );
    if (destLines) dest_nome = destLines[1].trim();

    const ruaMatch = afterExmo.match(
      /((?:Rua|Av\.|R\.|Travessa|Largo|Praça)\s+[A-Za-zÀ-ÿ\s,.\-0-9]+?\d+)/i,
    );
    if (ruaMatch) dest_morada = ruaMatch[1].trim();
  }

  if (!dest_nome) {
    const condMatch = fullText.match(/(Condom[ií]nio\s+[A-Za-zÀ-ÿ\s,.\-0-9]+?\d+)/i);
    if (condMatch) dest_nome = condMatch[1].trim();
  }

  if (!dest_morada) {
    const postalMatches = [...fullText.matchAll(/(\d{4}-\d{3}\s+[A-Za-zÀ-ÿ]+)/gi)];
    if (postalMatches.length >= 2) {
      dest_morada = dest_nome ? `${dest_nome}, ${postalMatches[1][1]}` : postalMatches[1][1];
    }
  }

  const destinatario: DestinatarioData = { nome: dest_nome, morada: dest_morada };

  // ──── TRANSPORT ────
  const cargaMatch =
    fullText.match(/disposi[cç][aã]o\s+na\s+data\s+(\d{4}-\d{2}-\d{2})(?:\s*\/\s*(\d{1,2}:\d{2}))?/i) ||
    fullText.match(/Carga[\s\S]{0,80}?(\d{4}-\d{2}-\d{2})(?:\s*\/\s*(\d{1,2}:\d{2}))?/i);
  const data_carga = cargaMatch ? cargaMatch[1] : "";
  const hora_carga = cargaMatch && cargaMatch[2] ? cargaMatch[2] : "";

  let carga_local = "";
  const cargaLocalMatch = fullText.match(
    /Carga.*?(?:N\/\s*Morada|Morada)[^A-Z]*([A-Za-zÀ-ÿ\s]+(?:de\s+)?[A-Za-zÀ-ÿ\s]+)/i,
  );
  if (cargaLocalMatch) carga_local = cargaLocalMatch[1].trim();
  if (!carga_local && morada_emissor) carga_local = morada_emissor;

  let descarga_local = "";
  const descargaMatch = fullText.match(
    /Descarga.*?(?:V\/\s*Morada|Morada)[^A-Z]*([A-Za-zÀ-ÿ\s,.\-0-9]+)/i,
  );
  if (descargaMatch) descarga_local = descargaMatch[1].trim();

  let disponibilizacao = "";
  const dispMatch = fullText.match(/colocados\s+[àa]\s+disposi[çc][ãa]o\s+na\s+data\s+(\d{4}-\d{2}-\d{2})/i);
  if (dispMatch) disponibilizacao = dispMatch[1];

  let certificacao = "";
  const certMatch = fullText.match(/Processado\s+por\s+Programa\s+Certificado\s+n\.?\s*º?\s*([^\n(]+)/i);
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

  // ──── INTELLIGENT ARTIGO EXTRACTION ────

  /** Check if a code is a forbidden fiscal number */
  const isForbidden = (code: string, context: string): boolean => {
    // Direct match with known NIFs
    if (code === vn_contrib || code === contribuinte) return true;
    // Date pattern
    if (/^\d{4}-\d{2}-\d{2}$/.test(code)) return true;
    // Portuguese NIF pattern check
    if (KNOWN_NIF_PATTERNS.some(p => p.test(code))) return true;
    // Fiscal zone context
    const lower = context.toLowerCase();
    if (FISCAL_ZONE_KEYWORDS.some(k => lower.includes(k))) return true;
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
    .sort((a, b) => b[0] - a[0])
    .map(([, toks]) => toks.sort((a, b) => a.x - b.x));

  // Find the header line
  let headerIdx = -1;
  let xArtigo = 0, xDesc = 0, xQtd = 0, xUn = 0;
  for (let i = 0; i < sortedLines.length; i++) {
    const joined = sortedLines[i].map((t) => t.str).join(" ").toLowerCase();
    if (joined.includes("artigo") && joined.includes("descri") && (joined.includes("qtd") || joined.includes("quant"))) {
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
    validations.push({ field: "tabela", status: "ok", message: `Cabeçalho encontrado na linha ${headerIdx}` });

    for (let i = headerIdx + 1; i < sortedLines.length; i++) {
      const line = sortedLines[i];
      if (!line.length) continue;
      const text = line.map((t) => t.str).join(" ");
      const lower = text.toLowerCase();

      if (STOP_TOKENS.some((t) => lower.includes(t))) break;

      const first = line[0].str.trim();
      if (!/^\d{4,}$/.test(first)) continue;
      if (isForbidden(first, text)) {
        validations.push({ field: "artigo", status: "warning", message: `Ignorado código fiscal: ${first}` });
        continue;
      }

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
      const unitOk = UNIT_SET.has(unit);
      const descOk = desc.length > 2 && !HEADER_NOISE.some((t) => desc.toLowerCase().includes(t));

      if (!qtyOk || !unitOk || !descOk) continue;

      const dedupeKey = `${artigo}|${qty}|${unit}|${desc}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      items.push({ artigo, descricao: desc, quantidade: qty, unidade: unit, checked: false });
    }
  }

  // Fallback regex
  if (items.length === 0) {
    validations.push({ field: "tabela", status: "warning", message: "Fallback: extração por regex" });
    const lineRegex =
      /(\d{6,})\s+((?:(?!\d{6,})[A-Za-zÀ-ÿ0-9.,\-/()\s])+?)\s+(\d{1,3}(?:[.,]\d{1,3})?)\s+(M2|M3|ML|UN|KG|LT|L|PC|CX|SC|UND|MT|M|TON|PAL)\b/gi;
    let m: RegExpExecArray | null;
    while ((m = lineRegex.exec(fullText)) !== null) {
      if (isForbidden(m[1], m[0])) continue;
      const desc = m[2].replace(/\s+/g, " ").trim();
      const qty = m[3];
      const unit = m[4].toUpperCase();
      if (!/^\d{1,5}(?:[.,]\d{1,3})?$/.test(qty)) continue;
      if (!UNIT_SET.has(unit)) continue;
      if (desc.length <= 2 || HEADER_NOISE.some((t) => desc.toLowerCase().includes(t))) continue;

      const dedupeKey = `${m[1]}|${qty}|${unit}|${desc}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      items.push({ artigo: m[1], descricao: desc, quantidade: qty, unidade: unit, checked: false });
    }
  }

  // QR Code extraction
  let qr_at_code = "";
  let qr_raw = "";
  let qr_confidence = 0;

  try {
    const { extractQRFromPdf } = await import("./qr-extract");
    const qrResults = await extractQRFromPdf(pdf, pdfjs);
    if (qrResults.length > 0) {
      const best = qrResults.reduce((a, b) => (b.confidence > a.confidence ? b : a));
      qr_at_code = best.atCode;
      qr_raw = best.raw;
      qr_confidence = best.confidence;
      validations.push({ field: "qr_code", status: "ok", message: `QR Code lido (confiança: ${qr_confidence}%)` });
    }
  } catch {
    validations.push({ field: "qr_code", status: "warning", message: "QR Code: biblioteca não disponível" });
  }

  // Validations summary
  if (items.length > 0) validations.push({ field: "artigos", status: "ok", message: `${items.length} artigos extraídos` });
  else validations.push({ field: "artigos", status: "error", message: "Nenhum artigo encontrado" });
  if (chave_at) validations.push({ field: "chave_at", status: "ok", message: `Chave AT: ${chave_at}` });
  if (data_documento) validations.push({ field: "data", status: "ok", message: `Data: ${data_documento}` });

  return {
    chave_at: qr_at_code || chave_at,
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
    qr_at_code,
    qr_raw,
    qr_confidence,
    validations,
    processing_time: Date.now() - startTime,
  };
}
