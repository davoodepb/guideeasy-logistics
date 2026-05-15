import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { setSession, getSession } from "@/lib/session";
import { logUserStore as logUser } from "@/lib/store";
import { toast } from "sonner";
import { Download } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — Prudêncio Checklist" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const s = getSession();
    if (s) navigate({ to: "/dashboard" });

    // Listen for PWA install prompt
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
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") {
      toast.success("App instalada com sucesso!");
    }
    setInstallPrompt(null);
  }

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Preencha nome e telefone");
      return;
    }
    setBusy(true);
    try {
      setSession({ name: name.trim(), phone: phone.trim() });
      logUser(name.trim(), phone.trim()).catch(() => {});
      navigate({ to: "/dashboard" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-gradient-to-br from-primary via-primary to-[oklch(0.22_0.07_255)] px-5 py-10 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center mb-8 text-primary-foreground">
            {/* Prudêncio Logo */}
            <div className="mb-2">
              <img src="/icon-512.png" alt="Prudêncio" className="size-20 rounded-2xl shadow-xl" />
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">Prudêncio</h1>
            <p className="text-xs text-primary-foreground/60 mt-0.5">Impermeabilizações</p>
            <p className="text-sm text-primary-foreground/70 mt-2">
              Guias de Transporte → Checklist
            </p>
          </div>

          <form
            onSubmit={handle}
            className="bg-card text-card-foreground rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div>
              <label className="text-sm font-medium">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="O seu nome"
                className="mt-1 h-12 w-full rounded-lg border border-input bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Telefone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="+351 ..."
                className="mt-1 h-12 w-full rounded-lg border border-input bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              disabled={busy}
              className="w-full h-12 rounded-lg bg-secondary text-secondary-foreground font-semibold hover:opacity-95 active:scale-[0.99] transition disabled:opacity-60"
            >
              {busy ? "A entrar..." : "Entrar"}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              A sessão fica guardada no dispositivo.
            </p>
          </form>

          {/* PWA Install Button */}
          {installPrompt && (
            <button
              onClick={handleInstall}
              className="mt-4 w-full h-12 rounded-xl bg-secondary/20 border-2 border-secondary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-secondary/30 transition"
            >
              <Download className="size-5" />
              Instalar App no Telemóvel
            </button>
          )}

          <p className="mt-6 text-center text-xs text-primary-foreground/60">
            <Link to="/dashboard">Ir para a aplicação</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
