/**
 * QR Code extractor from PDF pages.
 *
 * Renders each page of a PDF to an off-screen canvas and scans for QR codes.
 * Extracts the AT code from the QR code payload.
 *
 * Portuguese invoice QR codes typically encode a string like:
 *   A:123456789*B:901059978*C:PT*D:GT*E:N*F:20260505*G:GT GT.2026/67*H:ATCUD-123*I1:PT*...
 *   The "H" field often contains the ATCUD / AT key.
 *   Or sometimes a direct URL with the AT code.
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

/**
 * Attempt to extract QR codes from all pages of a loaded PDF document.
 * Returns array of QR results found.
 */
export async function extractQRFromPdf(
  pdfDoc: any, // PDFDocumentProxy
  pdfjs: any,
): Promise<QRResult[]> {
  const results: QRResult[] = [];

  // Dynamically import jsQR — if not installed, return empty
  let jsQR: any;
  try {
    const mod = await import("jsqr");
    jsQR = mod.default || mod;
  } catch {
    console.warn("[QR] jsqr not installed — skipping QR extraction");
    return results;
  }

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    try {
      const page = await pdfDoc.getPage(p);
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better QR reading

      // Create off-screen canvas
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Get image data for QR scanning
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        const parsed = parsePortugueseQR(code.data);
        results.push(parsed);
      }

      // Also try scanning specific regions (bottom-right, bottom-left)
      // QR codes in Portuguese invoices are often in the bottom area
      if (!code) {
        const regions = [
          // Bottom-right quadrant
          {
            x: Math.floor(canvas.width * 0.5),
            y: Math.floor(canvas.height * 0.5),
            w: Math.floor(canvas.width * 0.5),
            h: Math.floor(canvas.height * 0.5),
          },
          // Bottom-left quadrant
          {
            x: 0,
            y: Math.floor(canvas.height * 0.5),
            w: Math.floor(canvas.width * 0.5),
            h: Math.floor(canvas.height * 0.5),
          },
          // Top-right quadrant
          {
            x: Math.floor(canvas.width * 0.5),
            y: 0,
            w: Math.floor(canvas.width * 0.5),
            h: Math.floor(canvas.height * 0.5),
          },
        ];

        for (const region of regions) {
          const regionData = ctx.getImageData(region.x, region.y, region.w, region.h);
          const regionCode = jsQR(regionData.data, regionData.width, regionData.height, {
            inversionAttempts: "attemptBoth",
          });
          if (regionCode && regionCode.data) {
            const parsed = parsePortugueseQR(regionCode.data);
            results.push(parsed);
            break; // Found one, stop scanning regions
          }
        }
      }

      // Clean up
      canvas.width = 0;
      canvas.height = 0;
    } catch (err) {
      console.warn(`[QR] Error scanning page ${p}:`, err);
    }
  }

  return results;
}

/**
 * Parse a Portuguese fiscal QR code string.
 *
 * Format: A:NIF_EMITENTE*B:NIF_ADQUIRENTE*C:PAIS*D:TIPO*E:ESTADO*F:DATA*G:ID*H:ATCUD*...
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

  // Try standard Portuguese QR format (field:value separated by *)
  const fields = raw.split("*");
  let matchCount = 0;

  for (const field of fields) {
    const colonIdx = field.indexOf(":");
    if (colonIdx < 0) continue;
    const key = field.substring(0, colonIdx).trim().toUpperCase();
    const value = field.substring(colonIdx + 1).trim();

    switch (key) {
      case "A":
        result.nif_emitente = value;
        matchCount++;
        break;
      case "B":
        result.nif_adquirente = value;
        matchCount++;
        break;
      case "D":
        result.tipo_documento = value;
        matchCount++;
        break;
      case "F":
        // Date format: YYYYMMDD -> YYYY-MM-DD
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
      case "I1":
      case "I":
        // Sometimes the AT validation code is here
        break;
      case "Q":
        // Hash / AT code in some formats
        result.atCode = value;
        matchCount++;
        break;
      case "R":
        // Certificate number
        break;
    }
  }

  // If we couldn't find AT code in Q field, try to extract from ATCUD
  if (!result.atCode && result.atcud) {
    // ATCUD format is often: VALIDATION_CODE-SEQUENCE
    const parts = result.atcud.split("-");
    if (parts.length >= 1) {
      result.atCode = parts[0];
    }
  }

  // If the raw data is a URL, try to extract AT code from it
  if (!result.atCode && raw.startsWith("http")) {
    const urlMatch = raw.match(/[?&](?:at|code|chave)=([A-Z0-9]+)/i);
    if (urlMatch) result.atCode = urlMatch[1];
  }

  // Calculate confidence
  result.confidence = Math.min(100, Math.round((matchCount / 6) * 100));

  return result;
}
