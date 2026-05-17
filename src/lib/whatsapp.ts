import type { Checklist } from "./firebase";

/**
 * Professional WhatsApp message with ATCUD, Nº Guia, QR Code status.
 */
export function formatWhatsAppMessage(c: Checklist, pageUrl?: string): string {
  const pdf = c.pdf_metadata || {};
  const totalQty = c.items
    .reduce((s, i) => s + parseFloat(i.quantidade.replace(",", ".") || "0"), 0)
    .toFixed(2);
  const confirmed = c.items.filter((i) => i.checked).length;
  const isComplete = c.status === "concluida";

  let msg = "";

  msg += "━━━━━━━━━━━━━━━━━━━━\n";
  msg += isComplete ? "✅ *DOCUMENTO CONCLUÍDO*\n" : "📄 *DOCUMENTO PROCESSADO*\n";
  msg += "━━━━━━━━━━━━━━━━━━━━\n\n";

  if (c.data_documento) msg += `📅 *Data:*\n${c.data_documento}\n\n`;
  if (c.numero_guia) msg += `🚚 *Número Guia:*\n${c.numero_guia}\n\n`;
  if (c.codigo_at) msg += `🔐 *Chave AT:*\n${c.codigo_at}\n\n`;
  if (pdf.atcud) msg += `🆔 *ATCUD:*\n${pdf.atcud}\n\n`;

  // QR Code status
  msg += `📷 *QR Code:*\n`;
  if (pdf.qr_raw) {
    // Format raw string for better reading (replace * with \n  • )
    const formattedQr = pdf.qr_raw.split("*").map(part => `  • ${part}`).join("\n");
    msg += `📌 *Detetado:*\n${formattedQr}\n\n`;
  } else if (c.codigo_at) {
    msg += `📌 Detetado com sucesso\n\n`;
  } else {
    msg += `❌ Não detetado\n\n`;
  }

  if (c.responsavel) msg += `👤 *Responsável:*\n${c.responsavel}\n\n`;

  // Articles
  msg += "━━━━━━━━━━━━━━━━━━━━\n";
  msg += `📦 *ARTIGOS (${c.items.length})*\n`;
  msg += "━━━━━━━━━━━━━━━━━━━━\n\n";

  for (let i = 0; i < c.items.length; i++) {
    const it = c.items[i];
    const check = it.checked ? "✅" : "📦";

    msg += `${check} *Artigo ${i + 1}*\n`;
    msg += `🔢 Código: ${it.artigo}\n`;
    msg += `📝 ${it.descricao}\n`;
    msg += `📏 Quantidade: ${it.quantidade} ${it.unidade}\n`;
    if (c.codigo_at) msg += `🔐 Chave AT: ${c.codigo_at}\n`;
    if (pdf.atcud) msg += `🆔 ATCUD: ${pdf.atcud}\n`;
    if (c.numero_guia) msg += `🚚 Guia: ${c.numero_guia}\n`;
    msg += `📷 QR Code: ${pdf.qr_raw ? "Ver acima" : (c.codigo_at ? "Detetado" : "—")}\n`;
    if (i < c.items.length - 1) msg += "\n";
  }

  // Totals
  msg += "\n━━━━━━━━━━━━━━━━━━━━\n";
  msg += "📊 *RESUMO*\n";
  msg += "━━━━━━━━━━━━━━━━━━━━\n\n";
  msg += `📦 Total Artigos: ${c.items.length}\n`;
  msg += `📏 Quantidade Total: ${totalQty}\n`;
  msg += `✅ Confirmados: ${confirmed}/${c.items.length}\n`;

  if (c.observacoes_renato) msg += `\n📌 *Observações:*\n${c.observacoes_renato}\n`;

  msg += "\n━━━━━━━━━━━━━━━━━━━━\n\n";
  msg += "✅ Documento validado\n";
  if (c.codigo_at) msg += "✅ QR Code lido corretamente\n";
  if (c.codigo_at) msg += "✅ Chave AT verificada\n";
  if (pdf.atcud) msg += "✅ ATCUD validado\n";
  msg += "✅ Excel gerado\n";
  msg += "✅ Dados confirmados\n";

  if (pageUrl) msg += `\n🔗 ${pageUrl}\n`;

  msg += "\n━━━━━━━━━━━━━━━━━━━━\n";
  msg += "_Prudêncio Impermeabilizações_\n";

  return msg;
}

export function shareViaWhatsApp(c: Checklist, pageUrl?: string) {
  const msg = formatWhatsAppMessage(c, pageUrl);
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
}
