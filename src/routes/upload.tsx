import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { extractFromPdf, type ExtractedData } from "@/lib/pdf-extract";
import { createChecklistStore as createChecklist, type ChecklistItem } from "@/lib/store";
import { getSession } from "@/lib/session";
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
  Clock,
  FileCheck,
  ChevronDown,
  ChevronUp,
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

  async function analyze() {
    if (!file) return;
    setAnalyzing(true);
    try {
      // Fire webhook (n8n) — best-effort, non-blocking
      fetch(`${N8N_WEBHOOK}?filename=${encodeURIComponent(file.name)}&size=${file.size}`, {
        method: "GET",
        mode: "no-cors",
      }).catch(() => {});

      const data = await extractFromPdf(file);
      setExtracted(data);
      setChave(data.chave_at);
      setDataDoc(data.data_documento);
      setDataCarga(data.data_carga);
      setHoraCarga(data.hora_carga);
      setNumeroGuia(data.numero_guia);
      setItems(data.items);
      if (data.items.length === 0) {
        toast.warning("Nenhum artigo detetado. Pode editar manualmente.");
      } else {
        toast.success(`${data.items.length} artigos detetados`);
      }
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro a analisar PDF: " + msg);
    } finally {
      setAnalyzing(false);
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

  return (
    <main className="min-h-[100dvh] bg-background pb-24">
      <header className="bg-primary text-primary-foreground px-5 pt-6 pb-6 rounded-b-3xl">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm opacity-80">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Carregar Guia</h1>
        <p className="text-sm opacity-80">PDF → análise completa → checklist</p>
      </header>

      <section className="px-5 mt-5 space-y-4">
        <label className="block bg-card border-2 border-dashed border-primary/30 rounded-2xl p-6 text-center cursor-pointer hover:border-secondary transition">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setItems([]);
              setChave("");
              setExtracted(null);
            }}
          />
          <FileText className="size-10 mx-auto text-primary" />
          <p className="mt-2 font-semibold">{file ? file.name : "Selecionar PDF da Guia"}</p>
          <p className="text-xs text-muted-foreground">Toque para escolher um ficheiro</p>
        </label>

        <button
          disabled={!file || analyzing}
          onClick={analyze}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {analyzing ? (
            <>
              <Loader2 className="size-5 animate-spin" /> A analisar...
            </>
          ) : (
            <>
              <Sparkles className="size-5" /> Analisar PDF
            </>
          )}
        </button>

        {(chave || items.length > 0) && extracted && (
          <div className="space-y-4">
            {/* ─── DOCUMENT INFO ─── */}
            <div className="bg-card rounded-2xl border p-4 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="size-5 text-primary" />
                <h2 className="font-bold text-sm uppercase tracking-wider">Informação do Documento</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Chave AT</label>
                  <input
                    value={chave}
                    onChange={(e) => setChave(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Nº Guia</label>
                  <input
                    value={numeroGuia}
                    onChange={(e) => setNumeroGuia(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">ATCUD</label>
                  <input
                    value={extracted.atcud}
                    readOnly
                    className="mt-1 h-11 w-full rounded-lg border border-input bg-muted px-3 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Data Documento</label>
                  <input
                    type="date"
                    value={dataDoc}
                    onChange={(e) => setDataDoc(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">V/N.º Contrib.</label>
                  <input
                    value={extracted.vn_contrib}
                    readOnly
                    className="mt-1 h-11 w-full rounded-lg border border-input bg-muted px-3 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</label>
                  <input
                    value={extracted.tipo_documento}
                    readOnly
                    className="mt-1 h-11 w-full rounded-lg border border-input bg-muted px-3 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* ─── EMISSOR (Collapsible) ─── */}
            <div className="bg-card rounded-2xl border overflow-hidden">
              <button
                type="button"
                onClick={() => setShowEmissor(!showEmissor)}
                className="w-full flex items-center gap-2 p-4 text-left"
              >
                <Building2 className="size-5 text-secondary" />
                <span className="flex-1 font-bold text-sm uppercase tracking-wider">
                  Dados do Emissor (Remetente)
                </span>
                {showEmissor ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {showEmissor && (
                <div className="px-4 pb-4 space-y-2 text-sm border-t pt-3">
                  <InfoRow icon={<Building2 className="size-4" />} label="Empresa" value={extracted.emissor.empresa} />
                  <InfoRow icon={<Hash className="size-4" />} label="Contribuinte" value={extracted.emissor.contribuinte} />
                  <InfoRow icon={<MapPin className="size-4" />} label="Morada" value={extracted.emissor.morada} />
                  <InfoRow icon={<User className="size-4" />} label="Contactos" value={extracted.emissor.contactos} />
                  {extracted.emissor.capital_social && (
                    <InfoRow icon={<Hash className="size-4" />} label="Capital Social" value={extracted.emissor.capital_social} />
                  )}
                </div>
              )}
            </div>

            {/* ─── DESTINATÁRIO (Collapsible) ─── */}
            <div className="bg-card rounded-2xl border overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDestinatario(!showDestinatario)}
                className="w-full flex items-center gap-2 p-4 text-left"
              >
                <User className="size-5 text-secondary" />
                <span className="flex-1 font-bold text-sm uppercase tracking-wider">
                  Dados do Destinatário (Cliente)
                </span>
                {showDestinatario ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {showDestinatario && (
                <div className="px-4 pb-4 space-y-2 text-sm border-t pt-3">
                  <InfoRow icon={<User className="size-4" />} label="Nome" value={extracted.destinatario.nome} />
                  <InfoRow icon={<MapPin className="size-4" />} label="Morada" value={extracted.destinatario.morada} />
                </div>
              )}
            </div>

            {/* ─── TRANSPORTE (Collapsible) ─── */}
            <div className="bg-card rounded-2xl border overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTransporte(!showTransporte)}
                className="w-full flex items-center gap-2 p-4 text-left"
              >
                <Truck className="size-5 text-secondary" />
                <span className="flex-1 font-bold text-sm uppercase tracking-wider">
                  Dados de Transporte
                </span>
                {showTransporte ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {showTransporte && (
                <div className="px-4 pb-4 space-y-2 text-sm border-t pt-3">
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground">Data Carga</label>
                      <input
                        type="date"
                        value={dataCarga}
                        onChange={(e) => setDataCarga(e.target.value)}
                        className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground">Hora Carga</label>
                      <input
                        type="time"
                        value={horaCarga}
                        onChange={(e) => setHoraCarga(e.target.value)}
                        className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      />
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
                </div>
              )}
            </div>

            {/* ─── ARTIGOS ─── */}
            <div className="bg-card rounded-2xl border p-4 space-y-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <span className="size-6 bg-primary text-primary-foreground rounded-md flex items-center justify-center text-xs font-bold">
                  {items.length}
                </span>
                Artigos detetados
              </p>
              <ul className="divide-y rounded-lg border">
                {items.map((it, i) => (
                  <li key={i} className="p-3 flex gap-3 items-start">
                    <span className="text-xs font-mono text-muted-foreground shrink-0 bg-muted rounded px-1.5 py-0.5">
                      {it.artigo}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{it.descricao}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                      {it.quantidade} {it.unidade}
                    </span>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="p-4 text-sm text-muted-foreground text-center">Sem artigos</li>
                )}
              </ul>
            </div>

            {/* ─── OBSERVAÇÕES DO RENATO ─── */}
            <div className="bg-card rounded-2xl border p-4 space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span className="size-2 bg-secondary rounded-full" />
                Observações do Renato
              </label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={4}
                placeholder="Notas a enviar com a checklist..."
                className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-sm"
              />
            </div>

            {/* ─── GERAR CHECKLIST ─── */}
            <button
              onClick={generate}
              disabled={saving}
              className="w-full h-14 rounded-xl bg-secondary text-secondary-foreground font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg"
            >
              {saving ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <Send className="size-5" /> Gerar checklist
                </>
              )}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="font-medium break-words">{value}</p>
      </div>
    </div>
  );
}
