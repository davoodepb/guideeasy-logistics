import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getChecklistStore as getChecklist, updateChecklistStore as updateChecklist, type Checklist } from "@/lib/store";
import { getSession } from "@/lib/session";
import { toast } from "sonner";
import { ArrowLeft, Send, MessageCircle, Loader2 } from "lucide-react";

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
    getChecklist(id)
      .then((data) => {
        if (!data) {
          toast.error("Checklist não encontrada");
          navigate({ to: "/dashboard" });
          return;
        }
        setC(data);
        const s = getSession();
        if (s) setResp(s.name);
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  function toggle(i: number) {
    if (!c) return;
    setC({
      ...c,
      items: c.items.map((it, idx) => (idx === i ? { ...it, checked: !it.checked } : it)),
    });
  }

  function shareWhatsApp() {
    const url = `${window.location.origin}/checklist/${id}`;
    const msg = `📋 *Checklist Prudêncio*\n\nCódigo AT: ${c?.codigo_at}\nArtigos: ${c?.items.length}\n\nAbrir: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function submit() {
    if (!c) return;
    if (!resp.trim()) {
      toast.error("Indique o responsável");
      return;
    }
    setBusy(true);
    try {
      await updateChecklist(id, {
        items: c.items,
        responsavel: resp.trim(),
        observacoes_colaborador: obs,
        status: "concluida",
        submitted_at: Date.now(),
      });
      toast.success("Checklist submetida");
      navigate({ to: "/completed/$id", params: { id } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro: " + msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !c)
    return (
      <main className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );

  const done = c.items.filter((i) => i.checked).length;

  return (
    <main className="min-h-[100dvh] bg-background pb-32">
      <header className="bg-primary text-primary-foreground px-5 pt-6 pb-6 rounded-b-3xl">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm opacity-80">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Checklist</h1>
            <p className="text-sm opacity-80 font-mono">{c.codigo_at}</p>
          </div>
          <button
            onClick={shareWhatsApp}
            className="size-11 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow"
            aria-label="Enviar por WhatsApp"
          >
            <MessageCircle className="size-5" />
          </button>
        </div>
        <p className="mt-3 text-sm">
          Progresso: <span className="font-bold">{done}/{c.items.length}</span>
        </p>
      </header>

      {c.observacoes_renato && (
        <section className="px-5 mt-4">
          <div className="bg-secondary/15 border-l-4 border-secondary rounded-lg p-4">
            <p className="text-xs uppercase tracking-wider font-semibold text-secondary mb-1">
              Observações do Renato
            </p>
            <p className="text-sm whitespace-pre-wrap">{c.observacoes_renato}</p>
          </div>
        </section>
      )}

      <section className="px-5 mt-4 space-y-2">
        {c.items.map((it, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition active:scale-[0.99] ${
              it.checked ? "border-secondary bg-secondary/10" : "border-border bg-card"
            }`}
          >
            <div
              className={`size-7 rounded-md border-2 flex items-center justify-center shrink-0 ${
                it.checked ? "bg-secondary border-secondary text-secondary-foreground" : "border-input"
              }`}
            >
              {it.checked && (
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium leading-tight">{it.descricao}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{it.artigo}</p>
            </div>
            <span className="text-base font-bold tabular-nums shrink-0">
              {it.quantidade} {it.unidade}
            </span>
          </button>
        ))}
      </section>

      <section className="px-5 mt-6 space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Responsável</label>
          <input
            value={resp}
            onChange={(e) => setResp(e.target.value)}
            className="mt-1 h-12 w-full rounded-lg border border-input bg-card px-3"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Observações do Colaborador
          </label>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-input bg-card p-3"
          />
        </div>
      </section>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-background/95 backdrop-blur border-t">
        <button
          onClick={submit}
          disabled={busy}
          className="w-full h-14 rounded-xl bg-secondary text-secondary-foreground text-base font-bold flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <Send className="size-5" /> Submeter checklist
            </>
          )}
        </button>
      </div>
    </main>
  );
}
