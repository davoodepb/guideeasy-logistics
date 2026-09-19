// PDF extractor para documentos da Prudêncio Impermeabilizações.
// Suporta Guias de Transporte e Guias/Notas de Devolução.
// Extração visual de tabelas com deteção de colunas por coordenada X.

import type { ChecklistItem } from "./types";

const normalizarDataPT = (raw: string) => {
  if (!raw) return "";

  // Limpar espaços nas pontas e reduzir espaços internos
  const limpo = raw.trim().replace(/\s+/g, "");

  // 1. Procura padrão de data americana/ISO AAAA-MM-DD em qualquer lugar do texto
  const isoMatch = limpo.match(/(\d{4})[-/.](\d{2})[-/.](\d{2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2];
    const day = isoMatch[3];
    return `${day}/${month}/${year}`;
  }

  // 2. Procura padrão europeu/PT DD-MM-AAAA ou DD/MM/AAAA em qualquer lugar do texto
  const ptMatch = limpo.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
  if (ptMatch) {
    const day = ptMatch[1];
    const month = ptMatch[2];
    const year = ptMatch[3];
    return `${day}/${month}/${year}`;
  }

  return raw;
};

export type TipoGuia = "transporte" | "devolucao";

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
  tipo_guia: TipoGuia;
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

const UNIT_SET = new Set([
  "M2",
  "M3",
  "ML",
  "UN",
  "KG",
  "LT",
  "L",
  "PC",
  "CX",
  "SC",
  "UND",
  "MT",
  "M",
  "TON",
  "PAL",
  "KIT",
  "VB",
  "HR",
  "DIA",
]);

const STOP_TOKENS = [
  "este documento",
  "processado por",
  "atcud",
  "total",
  "totais",
  "iva",
  "observa",
  "pagamento",
  "rodape",
  "rodapé",
  "assinatura",
  "certificado",
  "software",
  "programa",
  "não serve de fatura",
];

const HEADER_NOISE = ["artigo", "descri", "qtd", "quant", "un.", "un "];

// Padrões que identificam um documento de Devolução
const DEVOLUCAO_PATTERNS = [
  /nota\s+de\s+devolu[çc][ãa]o/i,
  /guia\s+de\s+devolu[çc][ãa]o/i,
  /devolu[çc][ãa]o\s+de\s+mercadoria/i,
  /\bND\b/, // Nota de Devolução (código de documento)
  /\bGD\b/, // Guia de Devolução
];

/** Deteta o tipo de guia com base no texto completo do documento */
function detectTipoGuia(fullText: string): TipoGuia {
  for (const pattern of DEVOLUCAO_PATTERNS) {
    if (pattern.test(fullText)) return "devolucao";
  }
  return "transporte";
}

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
    for (const item of content.items) {
      if (!("str" in item) || !("transform" in item)) continue;
      const textItem = item as { str: string; transform: number[]; width?: number };
      const t = textItem.transform;
      tokens.push({ str: textItem.str, x: t[4], y: t[5], w: textItem.width ?? 0, page: p });
    }
  }

  const fullText = tokens.map((t) => t.str).join(" ");
  console.log("TEXTO BRUTO DO PDF:", fullText);

  // ──── TIPO DE GUIA ────
  const tipo_guia = detectTipoGuia(fullText);
  validations.push({
    field: "tipo_guia",
    status: "ok",
    message: `Tipo de documento detetado: ${tipo_guia === "devolucao" ? "Guia/Nota de Devolução" : "Guia de Transporte"}`,
  });

  // ──── CHAVE AT — CRÍTICO ────
  let chave_at = "";
  let chave_at_needs_validation = false;

  // Método 1: etiqueta exata "Chave AT:"
  const chaveMatch = fullText.match(/Chave\s+AT\s*[:\s]+(\d{8,})/i);
  if (chaveMatch) {
    chave_at = chaveMatch[1];
    validations.push({
      field: "chave_at",
      status: "ok",
      message: `Chave AT extraída do texto: ${chave_at}`,
    });
  }

  // Método 2: tokens visuais "Chave" + "AT" adjacentes
  if (!chave_at) {
    for (let i = 0; i < tokens.length - 2; i++) {
      const t0 = tokens[i];
      const t1 = tokens[i + 1];
      if (t0.str.toLowerCase().includes("chave") && t1.str.toLowerCase().includes("at")) {
        for (let j = i + 2; j < Math.min(i + 5, tokens.length); j++) {
          const candidate = tokens[j].str.replace(/[:\s]/g, "");
          if (/^\d{8,}$/.test(candidate)) {
            chave_at = candidate;
            validations.push({
              field: "chave_at",
              status: "ok",
              message: `Chave AT por posição visual: ${chave_at}`,
            });
            break;
          }
        }
        if (chave_at) break;
      }
    }
  }

  if (!chave_at) {
    chave_at_needs_validation = true;
    validations.push({
      field: "chave_at",
      status: "error",
      message: "Chave AT não encontrada — necessita validação manual",
    });
  }

  // ──── ATCUD ────
  const atcudMatch = fullText.match(/ATCUD[:\s]*([A-Z0-9][A-Z0-9-]+)/i);
  const atcud = atcudMatch ? atcudMatch[1] : "";

  // ──── Número da Guia ────
  // GT para Transporte, GD/ND para Devolução
  let numero_guia = "";
  if (tipo_guia === "devolucao") {
    const ndMatch =
      fullText.match(/(?:ND|GD)\s+(?:ND|GD)\.?(\d{4}\/\d+)/i) ||
      fullText.match(/(?:ND|GD)\.?(\d{4}\/\d+)/i);
    numero_guia = ndMatch ? `ND.${ndMatch[1]}` : "";
  } else {
    const gtMatch =
      fullText.match(/GT\s+GT\.?(\d{4}\/\d+)/i) || fullText.match(/GT\.?(\d{4}\/\d+)/i);
    numero_guia = gtMatch ? `GT.${gtMatch[1]}` : "";
  }

  // ──── Tipo de Documento (textual) ────
  let tipo_documento = "";
  if (tipo_guia === "devolucao") {
    const tipoDevMatch = fullText.match(/(?:Nota|Guia)\s+de\s+Devolu[çc][ãa]o/i);
    tipo_documento = tipoDevMatch ? tipoDevMatch[0] : "Nota de Devolução";
  } else {
    const tipoGTMatch = fullText.match(/Guia\s+de\s+[Tt]ransporte/i);
    tipo_documento = tipoGTMatch ? "Guia de Transporte" : "";
  }

  // Regex que apanha qualquer data (YYYY-MM-DD ou DD/MM/YYYY, com traços ou barras)
  const padraoData = /(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/;

  // ──── DATA DO DOCUMENTO ────
  let data_documento = "";
  const dataDocMatch = fullText.match(padraoData);
  if (dataDocMatch) {
    data_documento = dataDocMatch[1];
  }

  // ──── V/N.º Contrib (NIF do cliente) ────
  const vnContribMatch = fullText.match(/V\/N\.?\s*[ºo]?\s*Contrib\.?\s*[:\s]*(\d{9})/i);
  const vn_contrib = vnContribMatch ? vnContribMatch[1] : "";

  // ──── Requisição ────
  const reqMatch = fullText.match(/Requisi[çc][ãa]o[:\s]*([-A-Za-z0-9/]+)/i);
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
  const emailMatch = fullText.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
  if (emailMatch) contactos += (contactos ? " / " : "") + emailMatch[1];

  let capital_social = "";
  const capitalMatch = fullText.match(/Capital\s+Social\s+([\d\s.,]+\s*EUR)/i);
  if (capitalMatch) capital_social = capitalMatch[1].trim();

  const emissor: EmissorData = {
    empresa: empresa || "J. Prudêncio, LDA",
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
    const condMatch = afterExmo.match(/(Condom[ií]nio\s+[A-Za-zÀ-ÿ\s,.\-0-9]+?\d+)/i);
    if (condMatch) dest_nome = condMatch[1].trim();

    const ruaMatch = afterExmo.match(
      /((?:Rua|Av\.|R\.|Travessa|Largo|Praça)\s+[A-Za-zÀ-ÿ\s,.\-0-9]+?\d+)/i,
    );
    if (ruaMatch) dest_morada = ruaMatch[1].trim();

    if (!dest_morada && dest_nome) dest_morada = dest_nome;
  }

  if (!dest_nome) {
    const condMatch = fullText.match(/(Condom[ií]nio\s+[A-Za-zÀ-ÿ\s,.\-0-9]+?\d+)/i);
    if (condMatch) dest_nome = condMatch[1].trim();
  }

  const postalMatches = [...fullText.matchAll(/(\d{4}-\d{3}\s+[A-Za-zÀ-ÿ]+)/gi)];
  if (!dest_morada && postalMatches.length >= 2) {
    dest_morada = dest_nome ? `${dest_nome}, ${postalMatches[1][1]}` : postalMatches[1][1];
  }

  const destinatario: DestinatarioData = { nome: dest_nome, morada: dest_morada };

  // ──── TRANSPORTE (Data e Hora de Carga) ────
  let data_carga = "";
  let hora_carga = "";

  // Apanha qualquer data, ignora o lixo visual até 10 caracteres, e apanha a hora HH:MM
  const cargaFlexMatch = fullText.match(
    new RegExp(padraoData.source + `[^\\d]{0,10}(\\d{1,2}:\\d{2})`),
  );

  if (cargaFlexMatch) {
    data_carga = cargaFlexMatch[1];
    hora_carga = cargaFlexMatch[2];
  } else {
    // Fallback agressivo num raio de 100 caracteres após secções de transporte
    const fallbackRegex = new RegExp(
      `(?:Carga|Morada|Descarga|disposi[cç][aã]o)[\\s\\S]{0,100}?` +
        padraoData.source +
        `(?:[\\s\\S]{0,50}?(\\d{1,2}:\\d{2}))?`,
      "i",
    );
    const cargaFallback = fullText.match(fallbackRegex);
    if (cargaFallback) {
      data_carga = cargaFallback[1];
      hora_carga = cargaFallback[2] || "";
    }
  }

  console.log("DATAS EXTRAÍDAS:", { data_documento, data_carga, hora_carga });

  const carga_local = morada_emissor;
  let descarga_local = "";
  const descargaMatch = fullText.match(
    /(?:V\/\s*Morada|Descarga)[^A-Z]*?((?:Rua|Av|R\.|Travessa|Largo|Praça|Condom)[A-Za-zÀ-ÿ\s,.\-0-9]+)/i,
  );
  if (descargaMatch) descarga_local = descargaMatch[1].trim();

  let disponibilizacao = "";
  const dispMatch = fullText.match(
    /colocados\s+[àa]\s+disposi[çc][ãa]o\s+na\s+data\s+(\d{4}-\d{2}-\d{2})/i,
  );
  if (dispMatch) disponibilizacao = dispMatch[1];

  let certificacao = "";
  const certMatch = fullText.match(
    /Processado\s+por\s+Programa\s+Certificado\s+n\.?\s*[ºo]?\s*([^\n|]+?)(?:\s*[/|]|\s*$)/i,
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

  // ──── EXTRAÇÃO DE ARTIGOS ────

  /** Códigos que NUNCA são artigos */
  const isForbidden = (code: string, context: string): boolean => {
    if (code === vn_contrib) return true;
    if (code === contribuinte) return true;
    if (/^\d{4}-\d{2}-\d{2}$/.test(code)) return true;
    // NIF português: começa em 1,2,5,6,8,9 e tem exatamente 9 dígitos
    if (/^[125689]\d{8}$/.test(code)) return true;
    const lower = context.toLowerCase();
    const fiscalKeywords = [
      "contribuinte",
      "nif",
      "vat",
      "n.º contrib",
      "v/n",
      "cliente",
      "telefone",
      "telemóvel",
      "fax",
      "email",
      "código postal",
      "capital social",
      "matrícula",
    ];
    if (fiscalKeywords.some((k) => lower.includes(k))) return true;
    return false;
  };

  // Agrupar tokens em linhas visuais (por coordenada Y arredondada a 5 px)
  const lines = new Map<number, Tok[]>();
  for (const t of tokens) {
    const key = Math.round(t.y / 5) * 5;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key)!.push(t);
  }
  const sortedLines = [...lines.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, toks]) => toks.sort((a, b) => a.x - b.x));

  // Encontrar o cabeçalho da tabela de artigos
  // Aceita: "Artigo" + ("Descrição" | "Descricao") + ("Qtd" | "Quant" | "Quantidade")
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
    const hasArtigo = joined.includes("artigo");
    const hasDesc = joined.includes("descri");
    const hasQtd = joined.includes("qtd") || joined.includes("quant");

    if (hasArtigo && hasDesc && hasQtd) {
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

  const items: ChecklistItem[] = [];
  const seen = new Set<string>();

  if (headerIdx >= 0) {
    validations.push({
      field: "tabela",
      status: "ok",
      message: `Cabeçalho da tabela encontrado (linha visual ${headerIdx})`,
    });

    for (let i = headerIdx + 1; i < sortedLines.length; i++) {
      const line = sortedLines[i];
      if (!line.length) continue;
      const text = line.map((t) => t.str).join(" ");
      const lower = text.toLowerCase();

      if (STOP_TOKENS.some((t) => lower.includes(t))) break;

      // Linha de artigo: começa com código numérico (4+ dígitos)
      const first = line[0].str.trim();
      if (!/^\d{4,}$/.test(first)) continue;
      if (isForbidden(first, text)) {
        validations.push({
          field: "artigo",
          status: "warning",
          message: `Código fiscal ignorado: ${first}`,
        });
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
      validations.push({
        field: "artigo",
        status: "ok",
        message: `${artigo} — ${desc} (${qty} ${unit})`,
      });
    }
  }

  // Fallback por regex se a tabela visual não foi detetada
  if (items.length === 0) {
    validations.push({
      field: "tabela",
      status: "warning",
      message: "Fallback: extração por regex no texto completo",
    });
    const lineRegex =
      /(\d{4,})\s+((?:(?!\d{4,})[A-Za-zÀ-ÿ0-9.,\-/()\s])+?)\s+(\d{1,6}(?:[.,]\d{1,3})?)\s*(M2|M3|ML|UN|KG|LT|L|PC|CX|SC|UND|MT|M|TON|PAL|KIT|VB|HR|DIA)\b/gi;
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
    const qrResults = await extractQRFromPdf(pdf);
    if (qrResults.length > 0) {
      const best = qrResults.reduce((a, b) => (b.confidence > a.confidence ? b : a));
      qr_at_code = best.atCode;
      qr_raw = best.raw;
      qr_confidence = best.confidence;
      validations.push({
        field: "qr_code",
        status: "ok",
        message: `QR Code lido com ${qr_confidence}% confiança`,
      });

      if (qr_at_code && !chave_at) {
        chave_at = qr_at_code;
        chave_at_needs_validation = false;
        validations.push({
          field: "chave_at",
          status: "ok",
          message: `Chave AT obtida do QR Code: ${chave_at}`,
        });
      }
    }
  } catch {
    validations.push({
      field: "qr_code",
      status: "warning",
      message: "QR Code: biblioteca jsqr não disponível",
    });
  }

  if (items.length > 0) {
    validations.push({
      field: "resultado",
      status: "ok",
      message: `${items.length} artigos extraídos`,
    });
  } else {
    validations.push({
      field: "resultado",
      status: "error",
      message: "Nenhum artigo encontrado no documento",
    });
  }

  console.log("ARTIGOS ENCONTRADOS:", items);

  return {
    tipo_guia,
    chave_at,
    atcud,
    numero_guia,
    tipo_documento,
    data_documento: normalizarDataPT(data_documento),
    vn_contrib,
    requisicao,
    data_carga: normalizarDataPT(data_carga),
    hora_carga,
    emissor,
    destinatario,
    transporte: {
      ...transporte,
      carga_data: normalizarDataPT(data_carga),
      carga_hora: hora_carga,
      disponibilizacao: normalizarDataPT(disponibilizacao),
    },
    items,
    qr_at_code,
    qr_raw,
    qr_confidence,
    validations,
    processing_time: Date.now() - startTime,
    chave_at_needs_validation,
  };
}
