import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listChecklistsStore as listChecklists, type Checklist } from "@/lib/store";
import { getSession, clearSession } from "@/lib/session";
import { Upload, ClipboardList, CheckCircle2, LogOut, Clock, Download } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Prudêncio" }] }),
});

function Dashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Operador");
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/" });
      return;
    }
    setName(s.name);
    listChecklists()
      .then(setItems)
      .finally(() => setLoading(false));

    // PWA install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [navigate]);

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    setInstallPrompt(null);
  }

  const pendentes = items.filter((i) => i.status === "pendente");
  const concluidas = items.filter((i) => i.status === "concluida");

  return (
    <main className="min-h-[100dvh] bg-background pb-24">
      <header className="bg-primary text-primary-foreground px-5 pt-8 pb-10 rounded-b-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icon-512.png" alt="Prudêncio" className="size-10 rounded-xl shadow" />
            <div>
              <p className="text-xs uppercase tracking-wider text-primary-foreground/70">Olá</p>
              <h1 className="text-xl font-bold">{name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {installPrompt && (
              <button
                onClick={handleInstall}
                className="size-10 rounded-full bg-secondary/30 flex items-center justify-center"
                aria-label="Instalar App"
                title="Instalar App"
              >
                <Download className="size-5" />
              </button>
            )}
            <button
              onClick={() => {
                clearSession();
                navigate({ to: "/" });
              }}
              className="size-10 rounded-full bg-primary-foreground/10 flex items-center justify-center"
              aria-label="Sair"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          <StatCard label="Pendentes" value={pendentes.length} accent />
          <StatCard label="Concluídas" value={concluidas.length} />
          <StatCard label="Total" value={items.length} />
        </div>
      </header>

      <section className="px-5 -mt-6">
        <Link
          to="/upload"
          className="flex items-center gap-3 bg-secondary text-secondary-foreground rounded-2xl p-5 shadow-lg active:scale-[0.99] transition"
        >
          <div className="size-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Upload className="size-6" />
          </div>
          <div className="flex-1">
            <p className="font-bold">Carregar Guia (PDF)</p>
            <p className="text-sm opacity-80">Análise automática + checklist</p>
          </div>
        </Link>
      </section>

      <section className="px-5 mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Atividade recente
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">A carregar...</p>
        ) : items.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center border border-dashed">
            <ClipboardList className="size-8 text-muted-foreground mx-auto" />
            <p className="mt-2 text-sm text-muted-foreground">
              Sem checklists. Carregue uma Guia para começar.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li key={c.id}>
                <Link
                  to={c.status === "concluida" ? "/completed/$id" : "/checklist/$id"}
                  params={{ id: c.id }}
                  className="flex items-center gap-3 bg-card rounded-xl p-4 border hover:border-secondary transition"
                >
                  <div
                    className={`size-10 rounded-lg flex items-center justify-center ${
                      c.status === "concluida"
                        ? "bg-secondary/20 text-secondary"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {c.status === "concluida" ? (
                      <CheckCircle2 className="size-5" />
                    ) : (
                      <Clock className="size-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {c.numero_guia || c.codigo_at || "Sem código AT"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.items.length} artigos •{" "}
                      {new Date(c.created_at).toLocaleDateString("pt-PT")}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      c.status === "concluida"
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-4 ${
        accent
          ? "bg-secondary text-secondary-foreground"
          : "bg-primary-foreground/10 text-primary-foreground"
      }`}
    >
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs uppercase tracking-wider opacity-80">{label}</p>
    </div>
  );
}
