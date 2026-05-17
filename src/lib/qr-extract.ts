/**
 * QR Code extractor from PDF pages.
 * Renders each page at HIGH resolution and scans with multiple strategies.
 *
 * Portuguese fiscal QR format:
 *   A:NIF_EMITENTE*B:NIF_ADQUIRENTE*C:PT*D:GT*E:N*F:20260505*G:GT GT.2026/67*H:ATCUD*...*Q:HASH*R:CERT
 */

export type QRResult = {
  raw: string;
  atCode: string;
  atcud: string;
  nif_emitente: string;
  nif_adquirente: string;
  tipo_documento: string;
  data_documento: string;
  numero_documento: string;
  confidence: number;
};

export async function extractQRFromPdf(
  pdfDoc: any,
  pdfjs: any,
): Promise<QRResult[]> {
  const results: QRResult[] = [];

  let jsQR: any;
  try {
    const mod = await import("jsqr");
    jsQR = mod.default || mod;
  } catch {
    console.warn("[QR] jsqr not installed — skipping");
    return results;
  }

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    try {
      const page = await pdfDoc.getPage(p);

      // Try multiple scales — higher scale = more detail for QR reading
      const scales = [4.0, 3.0, 2.5, 2.0];
      let found = false;

      for (const scale of scales) {
        if (found) break;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        await page.render({ canvasContext: ctx, viewport }).promise;

        // Strategy 1: Scan full page
        const fullData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let code = jsQR(fullData.data, fullData.width, fullData.height, {
          inversionAttempts: "attemptBoth",
        });

        if (code && code.data && code.data.length > 10) {
          const parsed = parsePortugueseQR(code.data);
          if (parsed.confidence > 0) {
            results.push(parsed);
            found = true;
            canvas.width = 0;
            canvas.height = 0;
            break;
          }
        }

        // Strategy 2: Scan bottom-right corner (most common QR location in Portuguese invoices)
        const regions = [
          { x: Math.floor(canvas.width * 0.55), y: Math.floor(canvas.height * 0.6), w: Math.floor(canvas.width * 0.45), h: Math.floor(canvas.height * 0.4) },
          { x: Math.floor(canvas.width * 0.6), y: Math.floor(canvas.height * 0.65), w: Math.floor(canvas.width * 0.4), h: Math.floor(canvas.height * 0.35) },
          { x: Math.floor(canvas.width * 0.5), y: Math.floor(canvas.height * 0.5), w: Math.floor(canvas.width * 0.5), h: Math.floor(canvas.height * 0.5) },
          { x: 0, y: Math.floor(canvas.height * 0.6), w: Math.floor(canvas.width * 0.5), h: Math.floor(canvas.height * 0.4) },
        ];

        for (const r of regions) {
          if (found) break;
          try {
            const regionData = ctx.getImageData(r.x, r.y, r.w, r.h);
            const regionCode = jsQR(regionData.data, regionData.width, regionData.height, {
              inversionAttempts: "attemptBoth",
            });
            if (regionCode && regionCode.data && regionCode.data.length > 10) {
              const parsed = parsePortugueseQR(regionCode.data);
              if (parsed.confidence > 0) {
                results.push(parsed);
                found = true;
              }
            }
          } catch {}
        }

        canvas.width = 0;
        canvas.height = 0;
      }
    } catch (err) {
      console.warn(`[QR] Error scanning page ${p}:`, err);
    }
  }

  return results;
}

/**
 * Parse Portuguese fiscal QR code string.
 * Format: A:NIF*B:NIF*C:PT*D:GT*E:N*F:YYYYMMDD*G:DOC_ID*H:ATCUD*I1:PT*...*N:IVA*O:TOTAL*Q:HASH*R:CERT
 */
function parsePortugueseQR(raw: string): QRResult {
  const result: QRResult = {
    raw,
    atCode: "",
    atcud: "",
    nif_emitente: "",
    nif_adquirente: "",
    tipo_documento: "",
    data_documento: "",
    numero_documento: "",
    confidence: 0,
  };

  // Validate it looks like a Portuguese fiscal QR (must have A: and * separators)
  if (!raw.includes("*") || !raw.includes(":")) {
    return result;
  }

  const fields = raw.split("*");
  let matchCount = 0;

  for (const field of fields) {
    const colonIdx = field.indexOf(":");
    if (colonIdx < 0) continue;
    const key = field.substring(0, colonIdx).trim().toUpperCase();
    const value = field.substring(colonIdx + 1).trim();

    if (!value) continue;

    switch (key) {
      case "A":
        result.nif_emitente = value;
        matchCount++;
        break;
      case "B":
        result.nif_adquirente = value;
        matchCount++;
        break;
      case "C":
        // Country code (PT)
        if (value === "PT") matchCount++;
        break;
      case "D":
        result.tipo_documento = value;
        matchCount++;
        break;
      case "E":
        // Estado (N = Normal, A = Anulado)
        matchCount++;
        break;
      case "F":
        if (/^\d{8}$/.test(value)) {
          result.data_documento = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
        } else {
          result.data_documento = value;
        }
        matchCount++;
        break;
      case "G":
        result.numero_documento = value;
        matchCount++;
        break;
      case "H":
        result.atcud = value;
        matchCount++;
        break;
      case "Q":
        // Hash — this is the AT validation hash
        result.atCode = value;
        matchCount++;
        break;
      case "R":
        // Certificate number
        matchCount++;
        break;
    }
  }

  // If no AT code from Q field, try from ATCUD
  if (!result.atCode && result.atcud) {
    result.atCode = result.atcud;
  }

  // Calculate confidence based on how many standard fields were found
  // A valid Portuguese fiscal QR should have at least A, B, D, F, G, H fields
  result.confidence = Math.min(100, Math.round((matchCount / 8) * 100));

  return result;
}
