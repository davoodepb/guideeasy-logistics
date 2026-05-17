import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listChecklistsStore as listChecklists,
  type Checklist,
} from "@/lib/store";
import { isAuthenticated, clearSession } from "@/lib/session";
import {
  Upload,
  ClipboardList,
  CheckCircle2,
  LogOut,
  Clock,
  Shield,
  FileSpreadsheet,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Prudêncio" }] }),
});

function Dashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/" });
      return;
    }
    listChecklists()
      .then(setItems)
      .finally(() => setLoading(false));
  }, [navigate]);

  const pendentes = items.filter((i) => i.status === "pendente");
  const concluidas = items.filter((i) => i.status === "concluida");
  const totalArtigos = items.reduce((s, c) => s + c.items.length, 0);

  return (
    <main className="min-h-[100dvh] bg-background pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary via-primary to-[oklch(0.22_0.07_255)] text-primary-foreground px-5 pt-8 pb-10 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="/icon-512.png"
                alt="Prudêncio"
                className="size-11 rounded-xl shadow ring-2 ring-white/10"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-primary-foreground/50 flex items-center gap-1">
                <Shield className="size-3" /> Sistema protegido
              </p>
              <h1 className="text-xl font-bold">Prudêncio</h1>
            </div>
          </div>
          <button
            onClick={() => {
              clearSession();
              navigate({ to: "/" });
            }}
            className="size-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition"
            aria-label="Sair"
          >
            <LogOut className="size-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-6">
          <StatCard
            label="Pendentes"
            value={pendentes.length}
            icon={<Clock className="size-4" />}
            accent
          />
          <StatCard
            label="Concluídas"
            value={concluidas.length}
            icon={<CheckCircle2 className="size-4" />}
          />
          <StatCard
            label="Total"
            value={items.length}
            icon={<ClipboardList className="size-4" />}
          />
          <StatCard
            label="Artigos"
            value={totalArtigos}
            icon={<BarChart3 className="size-4" />}
          />
        </div>
      </header>

      {/* Upload CTA */}
      <section className="px-5 -mt-6">
        <Link
          to="/upload"
          className="flex items-center gap-3 bg-gradient-to-r from-secondary to-[oklch(0.65_0.20_180)] text-secondary-foreground rounded-2xl p-5 shadow-lg active:scale-[0.99] transition hover:shadow-xl"
        >
          <div className="size-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
            <Upload className="size-6" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-base">Carregar Guia (PDF)</p>
            <p className="text-sm opacity-80">
              OCR avançado + QR Code + Excel profissional
            </p>
          </div>
          <FileSpreadsheet className="size-5 opacity-60" />
        </Link>
      </section>

      {/* Recent Activity */}
      <section className="px-5 mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <span className="size-1.5 bg-secondary rounded-full" />
          Atividade recente
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center border border-dashed animate-fade-in-up">
            <ClipboardList className="size-10 text-muted-foreground mx-auto opacity-50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Sem checklists. Carregue uma Guia para começar.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((c, idx) => (
              <li
                key={c.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <Link
                  to={
                    c.status === "concluida"
                      ? "/completed/$id"
                      : "/checklist/$id"
                  }
                  params={{ id: c.id }}
                  className="flex items-center gap-3 bg-card rounded-xl p-4 border hover:border-secondary/50 hover:shadow-md transition-all"
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
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      c.status === "concluida"
                        ? "bg-secondary/15 text-secondary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.status === "concluida" ? "✓ Concluída" : "Pendente"}
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

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 text-center ${
        accent
          ? "bg-secondary text-secondary-foreground"
          : "bg-primary-foreground/10 text-primary-foreground"
      }`}
    >
      <div className="flex items-center justify-center gap-1 mb-1 opacity-70">
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-70">
        {label}
      </p>
    </div>
  );
}
