import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getChecklistStore as getChecklist, updateChecklistStore as updateChecklist, deleteChecklistStore, type Checklist } from "@/lib/store";
import { exportChecklistToExcel } from "@/lib/excel-export";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { getSession } from "@/lib/session";
import { InstallAppButton } from "@/components/InstallAppButton";
import { toast } from "sonner";
import { ArrowLeft, Send, MessageCircle, Loader2, Download, CheckCircle2, Package, Save, Trash2, FolderOpen } from "lucide-react";

export const Route = createFileRoute("/checklist/$id")({
  component: ChecklistPage,
  head: () => ({ meta: [{ title: "Checklist — Prudêncio" }] }),
});

function ChecklistPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<Checklist | null>(null);
  const [resp, setResp] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getChecklist(id).then((data) => {
      if (!data) { toast.error("Checklist não encontrada"); navigate({ to: "/dashboard" }); return; }
      setC(data);
      const s = getSession();
      if (s) setResp(s.name);
    }).finally(() => setLoading(false));
  }, [id, navigate]);

  function toggle(i: number) {
    if (!c) return;
    setC({ ...c, items: c.items.map((it, idx) => idx === i ? { ...it, checked: !it.checked } : it) });
  }

  async function submit() {
    if (!c) return;
    if (!resp.trim()) { toast.error("Indique o responsável"); return; }
    setBusy(true);
    try {
      await updateChecklist(id, { items: c.items, responsavel: resp.trim(), observacoes_colaborador: obs, status: "concluida", submitted_at: Date.now() });
      toast.success("Checklist submetida ✓");
      navigate({ to: "/completed/$id", params: { id } });
    } catch (e: unknown) { toast.error("Erro: " + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(false); }
  }

  if (loading || !c) return <main className="min-h-[100dvh] flex items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></main>;

  const done = c.items.filter((i) => i.checked).length;
  const pct = c.items.length ? Math.round((done / c.items.length) * 100) : 0;
  const totalQty = c.items.reduce((s, i) => s + parseFloat(i.quantidade.replace(",", ".") || "0"), 0).toFixed(2);

  return (
    <main className="min-h-[100dvh] bg-background pb-44">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary via-primary to-[oklch(0.22_0.07_255)] text-primary-foreground px-5 pt-6 pb-7 rounded-b-3xl shadow-lg">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100 transition">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Checklist</h1>
            <p className="text-sm opacity-80 font-mono">{c.numero_guia || c.codigo_at}</p>
          </div>
        </div>
        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span>Progresso: <span className="font-bold">{done}/{c.items.length}</span></span>
            <span className="font-bold">{pct}%</span>
          </div>
          <div className="h-2 bg-primary-foreground/15 rounded-full overflow-hidden">
            <div className="h-full progress-bar rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      {/* Info summary */}
      <section className="px-5 mt-4">
        <div className="bg-card rounded-xl border p-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Chave AT: <span className="font-mono font-semibold text-foreground">{c.codigo_at || "—"}</span></span>
          <span className="text-muted-foreground">Total: <span className="font-bold text-foreground">{totalQty}</span></span>
        </div>
      </section>

      {c.observacoes_renato && (
        <section className="px-5 mt-3">
          <div className="bg-secondary/10 border-l-4 border-secondary rounded-lg p-4">
            <p className="text-xs uppercase tracking-wider font-semibold text-secondary mb-1">Observações do Renato</p>
            <p className="text-sm whitespace-pre-wrap">{c.observacoes_renato}</p>
          </div>
        </section>
      )}

      {/* Items */}
      <section className="px-5 mt-4 space-y-2">
        {c.items.map((it, i) => (
          <button key={i} onClick={() => toggle(i)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all active:scale-[0.99] ${it.checked ? "border-secondary bg-secondary/8 shadow-sm" : "border-border bg-card hover:border-muted-foreground/20"}`}>
            <div className={`size-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${it.checked ? "bg-secondary border-secondary text-secondary-foreground" : "border-input"}`}>
              {it.checked && <CheckCircle2 className="size-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium leading-tight">{it.descricao}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1"><Package className="size-3" /> {it.artigo}</p>
            </div>
            <span className="text-base font-bold tabular-nums shrink-0">{it.quantidade} <span className="text-xs text-muted-foreground">{it.unidade}</span></span>
          </button>
        ))}
      </section>

      {/* Responsável + Observações */}
      <section className="px-5 mt-6 space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Responsável</label>
          <input value={resp} onChange={(e) => setResp(e.target.value)} className="mt-1 h-12 w-full rounded-lg border border-input bg-card px-3 focus:ring-2 focus:ring-ring outline-none transition" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Observações do Colaborador</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-input bg-card p-3" />
        </div>
      </section>

      {/* ═══ EXPANDED BOTTOM ACTIONS ═══ */}
      <div className="mt-8 mb-6 px-4 space-y-4 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
        
        {/* Core Actions Grid */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={submit} disabled={busy}
            className="h-14 rounded-xl bg-secondary text-secondary-foreground font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition hover:bg-secondary/90 active:scale-[0.98] disabled:opacity-60">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />} Guardar
          </button>
          
          <button onClick={() => { exportChecklistToExcel(c); toast.success("Excel exportado!"); }}
            className="h-14 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition hover:bg-blue-500 active:scale-[0.98]">
            <Download className="size-5" /> Download Excel
          </button>

          <button onClick={() => shareViaWhatsApp(c, `${window.location.origin}/checklist/${id}`)}
            className="h-14 rounded-xl bg-[#25D366] text-white font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition hover:bg-[#20b858] active:scale-[0.98]">
            <MessageCircle className="size-5" /> Enviar WhatsApp
          </button>

          <Link to="/dashboard"
            className="h-14 rounded-xl border-2 border-muted bg-card text-foreground font-bold flex items-center justify-center gap-2 text-sm shadow-sm transition hover:bg-muted/50 active:scale-[0.98]">
            <FolderOpen className="size-5" /> Histórico
          </Link>
        </div>

        <button onClick={async () => {
          if (confirm("Tem a certeza que deseja apagar este documento permanentemente?")) {
            setBusy(true);
            try {
              await deleteChecklistStore(c.id);
              toast.success("Documento apagado com sucesso.");
              navigate({ to: "/dashboard" });
            } catch (e: any) {
              toast.error(e.message);
              setBusy(false);
            }
          }
        }} disabled={busy}
          className="w-full h-12 rounded-xl bg-red-50 text-red-600 font-bold flex items-center justify-center gap-2 text-sm transition hover:bg-red-100 active:scale-[0.98]">
          <Trash2 className="size-4" /> Apagar PDF
        </button>

        {/* App Install Button */}
        <div className="pt-4 border-t">
          <InstallAppButton variant="full" />
        </div>
      </div>
    </main>
  );
}
