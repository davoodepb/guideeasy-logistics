import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { extractFromPdf, type ExtractedData } from "@/lib/pdf-extract";
import {
  createChecklistStore as createChecklist,
  type ChecklistItem,
} from "@/lib/store";
import { getSession } from "@/lib/session";
import { exportChecklistToExcel } from "@/lib/excel-export";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Sparkles,
  Send,
  Building2,
  MapPin,
  Truck,
  User,
  Hash,
  Calendar,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Download,
  MessageCircle,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

const N8N_WEBHOOK =
  "https://august-resupply-aflutter.ngrok-free.dev/webhook-test/801d4cc9-1387-4452-95dd-893db9419a7a";

export const Route = createFileRoute("/upload")({
  component: UploadPage,
  head: () => ({ meta: [{ title: "Carregar Guia — Prudêncio" }] }),
});

function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [chave, setChave] = useState("");
  const [dataDoc, setDataDoc] = useState("");
  const [dataCarga, setDataCarga] = useState("");
  const [horaCarga, setHoraCarga] = useState("");
  const [numeroGuia, setNumeroGuia] = useState("");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [showEmissor, setShowEmissor] = useState(false);
  const [showDestinatario, setShowDestinatario] = useState(false);
  const [showTransporte, setShowTransporte] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [progress, setProgress] = useState(0);

  async function analyze() {
    if (!file) return;
    setAnalyzing(true);
    setProgress(10);
    try {
      // Fire webhook (n8n) — best-effort, non-blocking
      fetch(
        `${N8N_WEBHOOK}?filename=${encodeURIComponent(file.name)}&size=${file.size}`,
        { method: "GET", mode: "no-cors" },
      ).catch(() => {});

      setProgress(30);
      const data = await extractFromPdf(file);
      setProgress(80);
      setExtracted(data);
      setChave(data.chave_at);
      setDataDoc(data.data_documento);
      setDataCarga(data.data_carga);
      setHoraCarga(data.hora_carga);
      setNumeroGuia(data.numero_guia);
      setItems(data.items);
      setProgress(100);

      if (data.items.length === 0) {
        toast.warning("Nenhum artigo detetado. Pode editar manualmente.");
      } else {
        toast.success(
          `${data.items.length} artigos detetados em ${data.processing_time}ms`,
        );
      }

      if (data.qr_at_code) {
        toast.success(`QR Code lido: ${data.qr_at_code}`);
      }
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro a analisar PDF: " + msg);
    } finally {
      setAnalyzing(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }

  async function generate() {
    if (!chave && items.length === 0) {
      toast.error("Analise primeiro o PDF");
      return;
    }
    setSaving(true);
    try {
      const session = getSession();
      const id = await createChecklist({
        codigo_at: chave,
        observacoes_renato: obs,
        items: items.map((i) => ({ ...i, checked: false })),
        status: "pendente",
        created_at: Date.now(),
        created_by: session?.name,
        data_documento: dataDoc,
        data_carga: dataCarga,
        hora_carga: horaCarga,
        numero_guia: numeroGuia,
        pdf_metadata: extracted
          ? {
              emissor_empresa: extracted.emissor.empresa,
              emissor_contribuinte: extracted.emissor.contribuinte,
              emissor_morada: extracted.emissor.morada,
              emissor_contactos: extracted.emissor.contactos,
              emissor_capital_social: extracted.emissor.capital_social,
              destinatario_nome: extracted.destinatario.nome,
              destinatario_morada: extracted.destinatario.morada,
              tipo_documento: extracted.tipo_documento,
              vn_contrib: extracted.vn_contrib,
              atcud: extracted.atcud,
              carga_local: extracted.transporte.carga_local,
              descarga_local: extracted.transporte.descarga_local,
              descarga_morada: extracted.transporte.descarga_morada,
              disponibilizacao: extracted.transporte.disponibilizacao,
              certificacao: extracted.transporte.certificacao,
            }
          : undefined,
      });
      toast.success("Checklist criada");
      navigate({ to: "/checklist/$id", params: { id } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro: " + msg);
    } finally {
      setSaving(false);
    }
  }

  function quickDownloadExcel() {
    if (!extracted || items.length === 0) return;
    exportChecklistToExcel({
      id: "preview",
      codigo_at: chave,
      observacoes_renato: obs,
      items,
      status: "pendente",
      created_at: Date.now(),
      data_documento: dataDoc,
      data_carga: dataCarga,
      hora_carga: horaCarga,
      numero_guia: numeroGuia,
      pdf_metadata: extracted
        ? {
            emissor_empresa: extracted.emissor.empresa,
            emissor_contribuinte: extracted.emissor.contribuinte,
            emissor_morada: extracted.emissor.morada,
            emissor_contactos: extracted.emissor.contactos,
            emissor_capital_social: extracted.emissor.capital_social,
            destinatario_nome: extracted.destinatario.nome,
            destinatario_morada: extracted.destinatario.morada,
            tipo_documento: extracted.tipo_documento,
            vn_contrib: extracted.vn_contrib,
            atcud: extracted.atcud,
            carga_local: extracted.transporte.carga_local,
            descarga_local: extracted.transporte.descarga_local,
            descarga_morada: extracted.transporte.descarga_morada,
            disponibilizacao: extracted.transporte.disponibilizacao,
            certificacao: extracted.transporte.certificacao,
          }
        : undefined,
    });
    toast.success("Excel exportado!");
  }

  function shareWhatsApp() {
    if (!extracted || items.length === 0) return;
    const lines = items
      .map(
        (i) =>
          `• ${i.artigo} | ${i.quantidade} ${i.unidade} | ${i.descricao}`,
      )
      .join("\n");
    const msg =
      `📋 *Guia de Transporte — Prudêncio*\n\n` +
      `📅 Data: ${dataDoc || "—"}\n` +
      `🔑 Chave AT: ${chave || "—"}\n` +
      `📄 Nº Guia: ${numeroGuia || "—"}\n\n` +
      `📦 *Artigos (${items.length}):*\n${lines}\n\n` +
      `✅ Total Qtd: ${items.reduce((s, i) => s + parseFloat(i.quantidade.replace(",", ".") || "0"), 0).toFixed(1)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <main className="min-h-[100dvh] bg-background pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary via-primary to-[oklch(0.22_0.07_255)] text-primary-foreground px-5 pt-6 pb-7 rounded-b-3xl shadow-lg">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100 transition"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Carregar Guia
        </h1>
        <p className="text-sm opacity-70">
          PDF → Análise OCR avançada → Checklist profissional
        </p>
      </header>

      {/* Progress bar */}
      {progress > 0 && (
        <div className="h-1 bg-muted mx-5 mt-3 rounded-full overflow-hidden">
          <div
            className="h-full progress-bar rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <section className="px-5 mt-5 space-y-4">
        {/* File picker */}
        <label className="block bg-card border-2 border-dashed border-primary/20 rounded-2xl p-7 text-center cursor-pointer hover:border-secondary/50 transition-all hover:shadow-md animate-fade-in-up">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setItems([]);
              setChave("");
              setExtracted(null);
              setProgress(0);
            }}
          />
          <div className="size-14 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
            <FileText className="size-7 text-primary" />
          </div>
          <p className="font-semibold text-base">
            {file ? file.name : "Selecionar PDF da Guia"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {file
              ? `${(file.size / 1024).toFixed(0)} KB`
              : "Toque para escolher um ficheiro"}
          </p>
        </label>

        {/* Analyze button */}
        <button
          disabled={!file || analyzing}
          onClick={analyze}
          className="w-full h-13 rounded-xl bg-gradient-to-r from-primary to-[oklch(0.35_0.10_255)] text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60 shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
        >
          {analyzing ? (
            <>
              <Loader2 className="size-5 animate-spin" /> A analisar com OCR
              avançado...
            </>
          ) : (
            <>
              <Sparkles className="size-5" /> Analisar PDF
            </>
          )}
        </button>

        {/* ═══ EXTRACTED DATA ═══ */}
        {(chave || items.length > 0) && extracted && (
          <div className="space-y-4 animate-fade-in-up">
            {/* QR Code badge */}
            {extracted.qr_at_code && (
              <div className="flex items-center gap-3 bg-secondary/15 border border-secondary/30 rounded-xl p-4 animate-slide-in-right">
                <div className="size-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                  <QrCode className="size-5 text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-secondary font-semibold">
                    QR Code Detetado
                  </p>
                  <p className="font-mono text-sm font-bold">
                    {extracted.qr_at_code}
                  </p>
                </div>
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full font-semibold">
                  {extracted.qr_confidence}%
                </span>
              </div>
            )}

            {/* Validation panel */}
            {extracted.validations.length > 0 && (
              <div className="bg-card rounded-2xl border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowValidation(!showValidation)}
                  className="w-full flex items-center gap-2 p-4 text-left"
                >
                  <ShieldCheck className="size-5 text-secondary" />
                  <span className="flex-1 font-bold text-sm uppercase tracking-wider">
                    Validação ({extracted.validations.length})
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {extracted.processing_time}ms
                  </span>
                  {showValidation ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </button>
                {showValidation && (
                  <div className="px-4 pb-4 space-y-2 border-t pt-3">
                    {extracted.validations.map((v, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm"
                      >
                        {v.status === "ok" && (
                          <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                        )}
                        {v.status === "warning" && (
                          <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                        )}
                        {v.status === "error" && (
                          <XCircle className="size-4 text-red-500 shrink-0" />
                        )}
                        <span className="text-muted-foreground">
                          {v.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Document info */}
            <div className="bg-card rounded-2xl border p-4 space-y-3 animate-scale-in">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="size-5 text-primary" />
                <h2 className="font-bold text-sm uppercase tracking-wider">
                  Informação do Documento
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Chave AT
                  </label>
                  <input
                    value={chave}
                    onChange={(e) => setChave(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm focus:ring-2 focus:ring-ring outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Nº Guia
                  </label>
                  <input
                    value={numeroGuia}
                    onChange={(e) => setNumeroGuia(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">
                    ATCUD
                  </label>
                  <input
                    value={extracted.atcud}
                    readOnly
                    className="mt-1 h-11 w-full rounded-lg border border-input bg-muted px-3 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Data Documento
                  </label>
                  <input
                    type="date"
                    value={dataDoc}
                    onChange={(e) => setDataDoc(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">
                    V/N.º Contrib.
                  </label>
                  <input
                    value={extracted.vn_contrib}
                    readOnly
                    className="mt-1 h-11 w-full rounded-lg border border-input bg-muted px-3 text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Emissor */}
            <CollapsibleSection
              icon={<Building2 className="size-5 text-secondary" />}
              title="Dados do Emissor"
              open={showEmissor}
              toggle={() => setShowEmissor(!showEmissor)}
            >
              <InfoRow icon={<Building2 className="size-4" />} label="Empresa" value={extracted.emissor.empresa} />
              <InfoRow icon={<Hash className="size-4" />} label="Contribuinte" value={extracted.emissor.contribuinte} />
              <InfoRow icon={<MapPin className="size-4" />} label="Morada" value={extracted.emissor.morada} />
              <InfoRow icon={<User className="size-4" />} label="Contactos" value={extracted.emissor.contactos} />
              {extracted.emissor.capital_social && (
                <InfoRow icon={<Hash className="size-4" />} label="Capital Social" value={extracted.emissor.capital_social} />
              )}
            </CollapsibleSection>

            {/* Destinatário */}
            <CollapsibleSection
              icon={<User className="size-5 text-secondary" />}
              title="Dados do Destinatário"
              open={showDestinatario}
              toggle={() => setShowDestinatario(!showDestinatario)}
            >
              <InfoRow icon={<User className="size-4" />} label="Nome" value={extracted.destinatario.nome} />
              <InfoRow icon={<MapPin className="size-4" />} label="Morada" value={extracted.destinatario.morada} />
            </CollapsibleSection>

            {/* Transporte */}
            <CollapsibleSection
              icon={<Truck className="size-5 text-secondary" />}
              title="Dados de Transporte"
              open={showTransporte}
              toggle={() => setShowTransporte(!showTransporte)}
            >
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Data Carga</label>
                  <input type="date" value={dataCarga} onChange={(e) => setDataCarga(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Hora Carga</label>
                  <input type="time" value={horaCarga} onChange={(e) => setHoraCarga(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" />
                </div>
              </div>
              <InfoRow icon={<MapPin className="size-4" />} label="Local Carga" value={extracted.transporte.carga_local} />
              <InfoRow icon={<MapPin className="size-4" />} label="Local Descarga" value={extracted.transporte.descarga_local} />
              {extracted.transporte.disponibilizacao && (
                <InfoRow icon={<Calendar className="size-4" />} label="Disponibilização" value={extracted.transporte.disponibilizacao} />
              )}
              {extracted.transporte.certificacao && (
                <InfoRow icon={<FileCheck className="size-4" />} label="Certificação" value={extracted.transporte.certificacao} />
              )}
            </CollapsibleSection>

            {/* Artigos */}
            <div className="bg-card rounded-2xl border p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <span className="size-7 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-xs font-bold">
                    {items.length}
                  </span>
                  Artigos detetados
                </p>
                <p className="text-xs text-muted-foreground">
                  Total:{" "}
                  {items
                    .reduce(
                      (s, i) =>
                        s +
                        parseFloat(i.quantidade.replace(",", ".") || "0"),
                      0,
                    )
                    .toFixed(1)}
                </p>
              </div>
              <ul className="divide-y rounded-xl border overflow-hidden">
                {items.map((it, i) => (
                  <li
                    key={i}
                    className="p-3 flex gap-3 items-start hover:bg-muted/50 transition"
                  >
                    <span className="text-xs font-mono text-muted-foreground shrink-0 bg-muted rounded-md px-2 py-1 min-w-[80px] text-center">
                      {it.artigo}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-tight">{it.descricao}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums whitespace-nowrap bg-primary/5 px-2 py-1 rounded-md">
                      {it.quantidade} {it.unidade}
                    </span>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="p-4 text-sm text-muted-foreground text-center">
                    Sem artigos
                  </li>
                )}
              </ul>
            </div>

            {/* Observações */}
            <div className="bg-card rounded-2xl border p-4 space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span className="size-2 bg-secondary rounded-full" />
                Observações do Renato
              </label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={3}
                placeholder="Notas a enviar com a checklist..."
                className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-sm"
              />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={quickDownloadExcel}
                className="h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 text-sm shadow hover:shadow-md transition"
              >
                <Download className="size-4" /> Excel
              </button>
              <button
                onClick={shareWhatsApp}
                className="h-12 rounded-xl bg-[#25D366] text-white font-semibold flex items-center justify-center gap-2 text-sm shadow hover:shadow-md transition"
              >
                <MessageCircle className="size-4" /> WhatsApp
              </button>
              <button
                onClick={generate}
                disabled={saving}
                className="h-12 rounded-xl bg-secondary text-secondary-foreground font-semibold flex items-center justify-center gap-2 text-sm shadow hover:shadow-md transition disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Guardar
              </button>
            </div>

            {/* Main CTA */}
            <button
              onClick={generate}
              disabled={saving}
              className="w-full h-14 rounded-xl bg-gradient-to-r from-secondary to-[oklch(0.65_0.20_180)] text-secondary-foreground font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg hover:shadow-xl transition-all active:scale-[0.99]"
            >
              {saving ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <Send className="size-5" /> Gerar checklist completa
                </>
              )}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

/* ═══ REUSABLE COMPONENTS ═══ */

function CollapsibleSection({
  icon,
  title,
  open,
  toggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  toggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl border overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-2 p-4 text-left hover:bg-muted/30 transition"
      >
        {icon}
        <span className="flex-1 font-bold text-sm uppercase tracking-wider">
          {title}
        </span>
        {open ? (
          <ChevronUp className="size-4" />
        ) : (
          <ChevronDown className="size-4" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 text-sm border-t pt-3 animate-fade-in-up">
          {children}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="font-medium break-words">{value}</p>
      </div>
    </div>
  );
}
