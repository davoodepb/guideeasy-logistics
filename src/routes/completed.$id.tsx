import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getChecklistStore as getChecklist, type Checklist } from "@/lib/store";
import { exportChecklistToExcel } from "@/lib/excel-export";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  MessageCircle,
  FileSpreadsheet,
  Calendar,
  User,
  Hash,
  FileText,
} from "lucide-react";
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
      if (!data) {
        toast.error("Não encontrada");
        navigate({ to: "/dashboard" });
        return;
      }
      setC(data);
    });
  }, [id, navigate]);

  if (!c)
    return (
      <main className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );

  function shareWhatsApp() {
    if (!c) return;
    const url = `${window.location.origin}/completed/${id}`;
    const text = `✅ Checklist *${c.numero_guia || c.codigo_at}* concluída por ${c.responsavel}.\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  function exportCSV() {
    if (!c) return;
    const headers = ["Artigo", "Descrição", "Quantidade", "Unidade", "Confirmado"];
    const rows = c.items.map((i) =>
      [i.artigo, `"${i.descricao}"`, i.quantidade, i.unidade, i.checked ? "Sim" : "Não"].join(";")
    );
    const csv = [headers.join(";"), ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checklist_${c.codigo_at || c.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado (compatível com Access)");
  }

  return (
    <main className="min-h-[100dvh] bg-background pb-24">
      <header className="bg-primary text-primary-foreground px-5 pt-6 pb-8 rounded-b-3xl">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm opacity-80">
          <ArrowLeft className="size-4" /> Dashboard
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <div className="size-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
            <CheckCircle2 className="size-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Concluída</h1>
            <p className="text-sm opacity-80 font-mono">{c.numero_guia || c.codigo_at}</p>
          </div>
        </div>
      </header>

      <section className="px-5 mt-5 space-y-4">
        {/* Summary Card */}
        <div className="bg-card rounded-2xl border p-4 grid grid-cols-2 gap-3 text-sm">
          <Field icon={<User className="size-4" />} label="Responsável" value={c.responsavel || "—"} />
          <Field
            icon={<Calendar className="size-4" />}
            label="Submetida"
            value={c.submitted_at ? new Date(c.submitted_at).toLocaleString("pt-PT") : "—"}
          />
          <Field icon={<Hash className="size-4" />} label="Código AT" value={c.codigo_at || "—"} />
          <Field icon={<FileText className="size-4" />} label="Nº Guia" value={c.numero_guia || "—"} />
          <Field
            icon={<CheckCircle2 className="size-4" />}
            label="Confirmados"
            value={`${c.items.filter((i) => i.checked).length}/${c.items.length}`}
          />
          <Field
            icon={<Calendar className="size-4" />}
            label="Criada em"
            value={new Date(c.created_at).toLocaleDateString("pt-PT")}
          />
        </div>

        {/* Observações */}
        {c.observacoes_renato && <Block title="Observações do Renato" body={c.observacoes_renato} accent />}
        {c.observacoes_colaborador && (
          <Block title="Observações do Colaborador" body={c.observacoes_colaborador} />
        )}

        {/* Artigos */}
        <div className="bg-card rounded-2xl border overflow-hidden">
          <p className="px-4 py-3 text-xs uppercase tracking-wider font-semibold border-b bg-muted flex items-center gap-2">
            <span className="size-5 bg-primary text-primary-foreground rounded flex items-center justify-center text-xs">
              {c.items.length}
            </span>
            Artigos
          </p>
          <ul className="divide-y">
            {c.items.map((it, i) => (
              <li key={i} className="p-3 flex items-center gap-3">
                <span
                  className={`size-6 rounded-full flex items-center justify-center text-xs ${
                    it.checked ? "bg-secondary text-secondary-foreground" : "bg-muted border"
                  }`}
                >
                  {it.checked ? "✓" : ""}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{it.descricao}</p>
                  <p className="text-xs text-muted-foreground font-mono">{it.artigo}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                  {it.quantidade} {it.unidade}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Export buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => exportChecklistToExcel(c)}
            className="h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 text-sm"
          >
            <Download className="size-4" /> Excel
          </button>
          <button
            onClick={exportCSV}
            className="h-12 rounded-xl bg-primary/80 text-primary-foreground font-semibold flex items-center justify-center gap-2 text-sm"
          >
            <FileSpreadsheet className="size-4" /> CSV
          </button>
          <button
            onClick={shareWhatsApp}
            className="h-12 rounded-xl bg-secondary text-secondary-foreground font-semibold flex items-center justify-center gap-2 text-sm"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </button>
        </div>
      </section>
    </main>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

function Block({ title, body, accent }: { title: string; body: string; accent?: boolean }) {
  return (
    <div
      className={`bg-card rounded-2xl border p-4 ${
        accent ? "border-l-4 border-l-secondary" : ""
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
      <p className="text-sm whitespace-pre-wrap">{body}</p>
    </div>
  );
}
