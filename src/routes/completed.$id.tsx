import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getChecklistStore as getChecklist, type Checklist } from "@/lib/store";
import { exportChecklistToExcel } from "@/lib/excel-export";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { ArrowLeft, CheckCircle2, Download, Loader2, MessageCircle, FileSpreadsheet, Calendar, User, Hash, FileText, Package, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/completed/$id")({
  component: CompletedPage,
  head: () => ({ meta: [{ title: "Concluída — Prudêncio" }] }),
});

function CompletedPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<Checklist | null>(null);

  useEffect(() => {
    getChecklist(id).then((data) => {
      if (!data) { toast.error("Não encontrada"); navigate({ to: "/dashboard" }); return; }
      setC(data);
    });
  }, [id, navigate]);

  if (!c) return <main className="min-h-[100dvh] flex items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></main>;

  const totalQty = c.items.reduce((s, i) => s + parseFloat(i.quantidade.replace(",", ".") || "0"), 0).toFixed(2);
  const confirmed = c.items.filter((i) => i.checked).length;

  function exportCSV() {
    if (!c) return;
    const h = ["Data", "Artigo", "Chave AT", "Descrição", "Quantidade", "Unidade", "Confirmado"];
    const rows = c.items.map((i) => [c.data_documento || "", i.artigo, c.codigo_at || "", `"${i.descricao}"`, i.quantidade, i.unidade, i.checked ? "Sim" : "Não"].join(";"));
    const csv = [h.join(";"), ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `checklist_${c.codigo_at || c.id}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  }

  return (
    <main className="min-h-[100dvh] bg-background pb-32">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary via-primary to-[oklch(0.22_0.07_255)] text-primary-foreground px-5 pt-6 pb-8 rounded-b-3xl shadow-lg">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100 transition">
          <ArrowLeft className="size-4" /> Dashboard
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <div className="size-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow-lg animate-scale-in">
            <CheckCircle2 className="size-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Concluída ✓</h1>
            <p className="text-sm opacity-80 font-mono">{c.numero_guia || c.codigo_at}</p>
          </div>
        </div>
      </header>

      <section className="px-5 mt-5 space-y-4">
        {/* Summary */}
        <div className="bg-card rounded-2xl border p-4 grid grid-cols-2 gap-3 text-sm animate-fade-in-up">
          <Field icon={<User className="size-4" />} label="Responsável" value={c.responsavel || "—"} />
          <Field icon={<Calendar className="size-4" />} label="Submetida" value={c.submitted_at ? new Date(c.submitted_at).toLocaleString("pt-PT") : "—"} />
          <Field icon={<Hash className="size-4" />} label="Chave AT" value={c.codigo_at || "—"} />
          <Field icon={<FileText className="size-4" />} label="Nº Guia" value={c.numero_guia || "—"} />
          <Field icon={<CheckCircle2 className="size-4" />} label="Confirmados" value={`${confirmed}/${c.items.length}`} />
          <Field icon={<BarChart3 className="size-4" />} label="Qtd Total" value={totalQty} />
          <Field icon={<Calendar className="size-4" />} label="Data Doc." value={c.data_documento || "—"} />
          <Field icon={<Calendar className="size-4" />} label="Criada em" value={new Date(c.created_at).toLocaleDateString("pt-PT")} />
        </div>

        {c.observacoes_renato && <Block title="Observações do Renato" body={c.observacoes_renato} accent />}
        {c.observacoes_colaborador && <Block title="Observações do Colaborador" body={c.observacoes_colaborador} />}

        {/* Artigos */}
        <div className="bg-card rounded-2xl border overflow-hidden">
          <div className="px-4 py-3 bg-muted border-b flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider font-semibold flex items-center gap-2">
              <span className="size-6 bg-primary text-primary-foreground rounded-md flex items-center justify-center text-xs font-bold">{c.items.length}</span>
              Artigos
            </p>
            <p className="text-xs text-muted-foreground font-semibold">Total: {totalQty}</p>
          </div>
          <ul className="divide-y">
            {c.items.map((it, i) => (
              <li key={i} className="p-3 flex items-center gap-3">
                <span className={`size-6 rounded-full flex items-center justify-center text-xs shrink-0 ${it.checked ? "bg-secondary text-secondary-foreground" : "bg-muted border"}`}>
                  {it.checked ? "✓" : ""}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-tight">{it.descricao}</p>
                  <p className="text-xs text-muted-foreground font-mono flex items-center gap-1"><Package className="size-3" /> {it.artigo}</p>
                </div>
                <span className="text-sm font-bold tabular-nums whitespace-nowrap">{it.quantidade} <span className="text-xs text-muted-foreground">{it.unidade}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══ FIXED BOTTOM TOOLBAR ═══ */}
      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-lg border-t shadow-2xl p-4 z-50">
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => { exportChecklistToExcel(c); toast.success("Excel exportado!"); }}
            className="h-13 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 text-sm shadow transition active:scale-[0.98]">
            <Download className="size-4" /> Excel
          </button>
          <button onClick={exportCSV}
            className="h-13 rounded-xl bg-primary/80 text-primary-foreground font-semibold flex items-center justify-center gap-2 text-sm shadow transition active:scale-[0.98]">
            <FileSpreadsheet className="size-4" /> CSV
          </button>
          <button onClick={() => shareViaWhatsApp(c, `${window.location.origin}/completed/${id}`)}
            className="h-13 rounded-xl bg-[#25D366] text-white font-semibold flex items-center justify-center gap-2 text-sm shadow transition active:scale-[0.98]">
            <MessageCircle className="size-4" /> WhatsApp
          </button>
        </div>
      </div>
    </main>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>
    </div>
  );
}

function Block({ title, body, accent }: { title: string; body: string; accent?: boolean }) {
  return (
    <div className={`bg-card rounded-2xl border p-4 ${accent ? "border-l-4 border-l-secondary" : ""}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
      <p className="text-sm whitespace-pre-wrap">{body}</p>
    </div>
  );
}
