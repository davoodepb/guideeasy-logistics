// PDF extractor for "Guia de Transporte" PDFs.
// Advanced extraction with visual table detection, NIF filtering, and contextual validation.

import type { ChecklistItem } from "./firebase";

export type EmissorData = {
  empresa: string;
  contribuinte: string;
  morada: string;
  contactos: string;
  capital_social: string;
};

export type DestinatarioData = {
  nome: string;
  morada: string;
};

export type TransporteData = {
  carga_local: string;
  carga_data: string;
  carga_hora: string;
  descarga_local: string;
  descarga_morada: string;
  disponibilizacao: string;
  certificacao: string;
};

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
  requisicao: string;
  data_carga: string;
  hora_carga: string;
  emissor: EmissorData;
  destinatario: DestinatarioData;
  transporte: TransporteData;
  items: ChecklistItem[];
  qr_at_code: string;
  qr_raw: string;
  qr_confidence: number;
  validations: ValidationEntry[];
  processing_time: number;
  chave_at_needs_validation: boolean;
};

const UNIT_SET = new Set(["M2", "M3", "ML", "UN", "KG", "LT", "L", "PC", "CX", "SC", "UND", "MT", "M", "TON", "PAL"]);

const STOP_TOKENS = [
  "este documento", "processado por", "atcud",
  "total", "totais", "iva", "observa", "pagamento", "rodape", "rodapé",
  "assinatura", "certificado", "software", "programa",
  "não serve de fatura",
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

  // ──── CHAVE AT — CRITICAL: Extract ONLY from "Chave AT:" label ────
  // The Chave AT is ALWAYS on a line that starts with "Chave AT:"
  // It is NOT the NIF, NOT the V/N Contrib, NOT any other number
  let chave_at = "";
  let chave_at_needs_validation = false;

  // Method 1: Look for exact "Chave AT:" or "Chave AT :" followed by the code
  const chaveMatch = fullText.match(/Chave\s+AT\s*[:\s]+(\d{8,})/i);
  if (chaveMatch) {
    chave_at = chaveMatch[1];
    validations.push({ field: "chave_at", status: "ok", message: `Chave AT extraída do texto: ${chave_at}` });
  }

  // Method 2: If not found, try visual position — find "Chave" and "AT" tokens near each other
  if (!chave_at) {
    for (let i = 0; i < tokens.length - 2; i++) {
      const t0 = tokens[i];
      const t1 = tokens[i + 1];
      if (
        t0.str.toLowerCase().includes("chave") &&
        t1.str.toLowerCase().includes("at")
      ) {
        // The next token(s) after "Chave AT" should be the code
        for (let j = i + 2; j < Math.min(i + 5, tokens.length); j++) {
          const candidate = tokens[j].str.replace(/[:\s]/g, "");
          if (/^\d{8,}$/.test(candidate)) {
            chave_at = candidate;
            validations.push({ field: "chave_at", status: "ok", message: `Chave AT extraída por posição visual: ${chave_at}` });
            break;
          }
        }
        if (chave_at) break;
      }
    }
  }

  // If still not found, mark as needs validation
  if (!chave_at) {
    chave_at_needs_validation = true;
    validations.push({ field: "chave_at", status: "error", message: "Chave AT não encontrada — necessita validação manual" });
  }

  // ──── ATCUD ────
  const atcudMatch = fullText.match(/ATCUD[:\s]*([A-Z0-9][A-Z0-9\-]+)/i);
  const atcud = atcudMatch ? atcudMatch[1] : "";

  // ──── Número da Guia ────
  const guiaMatch = fullText.match(/GT\s+GT\.?(\d{4}\/\d+)/i) || fullText.match(/GT\.?(\d{4}\/\d+)/i);
  const numero_guia = guiaMatch ? `GT.${guiaMatch[1]}` : "";

  // ──── Tipo de Documento ────
  const tipoMatch = fullText.match(/Guia\s+de\s+[Tt]ransporte/i);
  const tipo_documento = tipoMatch ? "Guia de Transporte" : "";

  // ──── Data do Documento ────
  // Look specifically in the "Data" column near "Requisição"
  let data_documento = "";
  const dataDocMatch = fullText.match(/(?:Requisi[çc][ãa]o|Data)[^0-9]{0,40}(\d{4}-\d{2}-\d{2})/i);
  if (dataDocMatch) {
    data_documento = dataDocMatch[1];
  } else {
    // Fallback: first ISO date after "Data"
    const fallbackDate = fullText.match(/Data[^0-9]{0,30}(\d{4}-\d{2}-\d{2})/i);
    if (fallbackDate) data_documento = fallbackDate[1];
  }

  // ──── V/N.º Contrib (client NIF — NEVER treat as artigo) ────
  const vnContribMatch = fullText.match(/V\/N\.?\s*[ºo]?\s*Contrib\.?\s*[:\s]*(\d{9})/i);
  const vn_contrib = vnContribMatch ? vnContribMatch[1] : "";

  // ──── Requisição ────
  const reqMatch = fullText.match(/Requisi[çc][ãa]o[:\s]*([A-Za-z0-9\-\/]+)/i);
  const requisicao = reqMatch ? reqMatch[1].trim() : "";

  // ──── EMISSOR ────
  let empresa = "";
  const empresaMatch = fullText.match(/J\.\s*PRUD[EÊ]NCIO[,\s]*LDA/i);
  if (empresaMatch) empresa = "J. PRUDÊNCIO, LDA";

  const contribMatch = fullText.match(/Contribuinte\s*N\.?\s*[ºo]?\s*[:\s]*(\d{9})/i);
  const contribuinte = contribMatch ? contribMatch[1] : "";

  let morada_emissor = "";
  const moradaMatch = fullText.match(/Parque\s+Industrial\s+de\s+Sete\s+Fontes/i);
  if (moradaMatch) morada_emissor = "Parque Industrial de Sete Fontes, BRAGA, 4710-553 BRAGA";

  let contactos = "";
  const telMatch = fullText.match(/Telef\.?\s*([\d\s]+)/i);
  if (telMatch) contactos = `Telef. ${telMatch[1].trim()}`;
  const emailMatch = fullText.match(/([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})/i);
  if (emailMatch) contactos += (contactos ? " / " : "") + emailMatch[1];

  let capital_social = "";
  const capitalMatch = fullText.match(/Capital\s+Social\s+([\d\s.,]+\s*EUR)/i);
  if (capitalMatch) capital_social = capitalMatch[1].trim();

  // Matrícula / Cons. Reg. Com
  let matricula = "";
  const matMatch = fullText.match(/Matr[ií]cula\s+N\.?\s*[ºo]?\s*[:\s]*(\d+)/i);
  if (matMatch) matricula = matMatch[1];

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
    // Look for "Condomínio" pattern first
    const condMatch = afterExmo.match(/(Condom[ií]nio\s+[A-Za-zÀ-ÿ\s,.\-0-9]+?\d+)/i);
    if (condMatch) dest_nome = condMatch[1].trim();

    // Look for street
    const ruaMatch = afterExmo.match(
      /((?:Rua|Av\.|R\.|Travessa|Largo|Praça)\s+[A-Za-zÀ-ÿ\s,.\-0-9]+?\d+)/i,
    );
    if (ruaMatch) dest_morada = ruaMatch[1].trim();

    // If no specific street, try to get the full address
    if (!dest_morada && dest_nome) {
      dest_morada = dest_nome;
    }
  }

  // Fallback for Condomínio
  if (!dest_nome) {
    const condMatch = fullText.match(/(Condom[ií]nio\s+[A-Za-zÀ-ÿ\s,.\-0-9]+?\d+)/i);
    if (condMatch) dest_nome = condMatch[1].trim();
  }

  // Get postal code for destinatário
  const postalMatches = [...fullText.matchAll(/(\d{4}-\d{3}\s+[A-Za-zÀ-ÿ]+)/gi)];
  if (!dest_morada && postalMatches.length >= 2) {
    dest_morada = dest_nome ? `${dest_nome}, ${postalMatches[1][1]}` : postalMatches[1][1];
  }

  const destinatario: DestinatarioData = { nome: dest_nome, morada: dest_morada };

  // ──── TRANSPORT ────
  // Look for Carga date/time
  const cargaDateMatch =
    fullText.match(/(?:N\/\s*Morada|Carga)[\s\-]*(\d{4}-\d{2}-\d{2})\s*\/?\s*(\d{1,2}:\d{2})?/i) ||
    fullText.match(/disposi[cç][aã]o\s+na\s+data\s+(\d{4}-\d{2}-\d{2})(?:\s*\/\s*(\d{1,2}:\d{2}))?/i);
  const data_carga = cargaDateMatch ? cargaDateMatch[1] : "";
  const hora_carga = cargaDateMatch && cargaDateMatch[2] ? cargaDateMatch[2] : "";

  let carga_local = "";
  if (morada_emissor) carga_local = morada_emissor;

  let descarga_local = "";
  const descargaMatch = fullText.match(
    /(?:V\/\s*Morada|Descarga)[^A-Z]*?((?:Rua|Av|R\.|Travessa|Largo|Praça|Condom)[A-Za-zÀ-ÿ\s,.\-0-9]+)/i,
  );
  if (descargaMatch) descarga_local = descargaMatch[1].trim();

  let disponibilizacao = "";
  const dispMatch = fullText.match(/colocados\s+[àa]\s+disposi[çc][ãa]o\s+na\s+data\s+(\d{4}-\d{2}-\d{2})/i);
  if (dispMatch) disponibilizacao = dispMatch[1];

  let certificacao = "";
  const certMatch = fullText.match(/Processado\s+por\s+Programa\s+Certificado\s+n\.?\s*[ºo]?\s*([^\n|]+?)(?:\s*[/|]|\s*$)/i);
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

  // ──── ARTIGO EXTRACTION ────

  /** NEVER treat these as artigos */
  const isForbidden = (code: string, context: string): boolean => {
    if (code === vn_contrib) return true;
    if (code === contribuinte) return true;
    if (/^\d{4}-\d{2}-\d{2}$/.test(code)) return true;
    // Portuguese NIF pattern: starts with 1,2,5,6,8,9 and is exactly 9 digits
    if (/^[125689]\d{8}$/.test(code)) return true;
    const lower = context.toLowerCase();
    const fiscalKeywords = ["contribuinte", "nif", "vat", "n.º contrib", "v/n", "cliente", "telefone", "telemóvel", "fax", "email", "código postal", "capital social", "matrícula"];
    if (fiscalKeywords.some(k => lower.includes(k))) return true;
    return false;
  };

  // Group tokens into visual lines
  const lines = new Map<number, Tok[]>();
  for (const t of tokens) {
    const key = Math.round(t.y / 5) * 5;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key)!.push(t);
  }
  const sortedLines = [...lines.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, toks]) => toks.sort((a, b) => a.x - b.x));

  // Find the header line with "Artigo" + "Descrição" + "Qtd"
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
    // Try with relaxed criteria — at least artigo and desc
    if (!xArtigo || !xDesc) headerIdx = -1;
  }

  const items: ChecklistItem[] = [];
  const seen = new Set<string>();

  if (headerIdx >= 0) {
    validations.push({ field: "tabela", status: "ok", message: `Cabeçalho da tabela encontrado na linha visual ${headerIdx}` });

    for (let i = headerIdx + 1; i < sortedLines.length; i++) {
      const line = sortedLines[i];
      if (!line.length) continue;
      const text = line.map((t) => t.str).join(" ");
      const lower = text.toLowerCase();

      if (STOP_TOKENS.some((t) => lower.includes(t))) break;

      // Article line starts with a numeric code (4+ digits)
      const first = line[0].str.trim();
      if (!/^\d{4,}$/.test(first)) continue;
      if (isForbidden(first, text)) {
        validations.push({ field: "artigo", status: "warning", message: `Código fiscal ignorado: ${first} (NIF/VAT)` });
        continue;
      }

      const artigo = first;
      let descricao = "";
      let qtd = "";
      let un = "";

      for (const t of line.slice(1)) {
        const tx = t.x;
        if (xUn && tx >= xUn - 10) {
          un += t.str;
        } else if (xQtd && tx >= xQtd - 35) {
          qtd += t.str;
        } else {
          descricao += (descricao ? " " : "") + t.str;
        }
      }

      const desc = descricao.trim();
      const qty = qtd.trim().replace(/\s/g, "");
      const unit = un.trim().toUpperCase();
      const qtyOk = /^\d{1,6}(?:[.,]\d{1,3})?$/.test(qty);
      const unitOk = UNIT_SET.has(unit);
      const descOk = desc.length > 2 && !HEADER_NOISE.some((t) => desc.toLowerCase().includes(t));

      if (!qtyOk || !unitOk || !descOk) continue;

      const dedupeKey = `${artigo}|${qty}|${unit}|${desc}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      items.push({ artigo, descricao: desc, quantidade: qty, unidade: unit, checked: false });
      validations.push({ field: "artigo", status: "ok", message: `✓ ${artigo} — ${desc} (${qty} ${unit})` });
    }
  }

  // Fallback regex extraction
  if (items.length === 0) {
    validations.push({ field: "tabela", status: "warning", message: "Fallback: extração por regex no texto completo" });
    const lineRegex =
      /(\d{6,})\s+((?:(?!\d{6,})[A-Za-zÀ-ÿ0-9.,\-/()\s])+?)\s+(\d{1,6}(?:[.,]\d{1,3})?)\s+(M2|M3|ML|UN|KG|LT|L|PC|CX|SC|UND|MT|M|TON|PAL)\b/gi;
    let m: RegExpExecArray | null;
    while ((m = lineRegex.exec(fullText)) !== null) {
      if (isForbidden(m[1], m[0])) continue;
      const desc = m[2].replace(/\s+/g, " ").trim();
      const qty = m[3];
      const unit = m[4].toUpperCase();
      if (desc.length <= 2 || HEADER_NOISE.some((t) => desc.toLowerCase().includes(t))) continue;

      const dedupeKey = `${m[1]}|${qty}|${unit}|${desc}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      items.push({ artigo: m[1], descricao: desc, quantidade: qty, unidade: unit, checked: false });
    }
  }

  // ──── QR CODE ────
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
      validations.push({ field: "qr_code", status: "ok", message: `QR Code lido com ${qr_confidence}% confiança` });

      // If QR code has an AT code and we didn't find one in text, use QR's
      if (qr_at_code && !chave_at) {
        chave_at = qr_at_code;
        chave_at_needs_validation = false;
        validations.push({ field: "chave_at", status: "ok", message: `Chave AT obtida do QR Code: ${chave_at}` });
      }
    }
  } catch {
    validations.push({ field: "qr_code", status: "warning", message: "QR Code: biblioteca jsqr não disponível" });
  }

  // Final validation summary
  if (items.length > 0) {
    validations.push({ field: "resultado", status: "ok", message: `${items.length} artigos extraídos com sucesso` });
  } else {
    validations.push({ field: "resultado", status: "error", message: "Nenhum artigo encontrado no documento" });
  }

  return {
    chave_at,
    atcud,
    numero_guia,
    tipo_documento,
    data_documento,
    vn_contrib,
    requisicao,
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
    chave_at_needs_validation,
  };
}
