import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authenticate, setSession, getSession } from "@/lib/session";
import { logUserStore as logUser } from "@/lib/store";
import { toast } from "sonner";
import { InstallAppButton } from "@/components/InstallAppButton";
import { Lock, Eye, EyeOff, Shield, Loader2 } from "lucide-react";

export const Route = createFileRoute("/")(
  {
    component: LoginPage,
    head: () => ({ meta: [{ title: "Acesso — Prudêncio Checklist" }] }),
  },
);

function LoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const s = getSession();
    if (s) navigate({ to: "/dashboard" });
  }, [navigate]);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      toast.error("Introduza a password de acesso");
      return;
    }

    setBusy(true);
    // Small delay for UX
    await new Promise((r) => setTimeout(r, 600));

    if (authenticate(password.trim())) {
      setSession({ name: "Operador", phone: "", authenticated: true });
      logUser("Operador", "").catch(() => {});
      toast.success("Acesso autorizado ✓");
      navigate({ to: "/dashboard" });
    } else {
      setAttempts((a) => a + 1);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      toast.error("Password incorreta");
      setPassword("");
    }
    setBusy(false);
  }

  return (
    <main className="min-h-[100dvh] bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a2540] px-5 py-10 flex flex-col relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#3b82f6]/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] bg-[#10b981]/6 rounded-full blur-[100px] pointer-events-none" />

      <div className="flex-1 flex items-center justify-center relative z-10">
        <div className="w-full max-w-sm">
          {/* Logo + Title */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-3">
              <div className="absolute inset-0 bg-[#3b82f6]/30 rounded-2xl blur-xl animate-pulse" />
              <img
                src="/icon-512.png"
                alt="Prudêncio"
                className="relative size-20 rounded-2xl shadow-2xl ring-2 ring-white/10"
              />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
              Prudêncio
            </h1>
            <p className="text-xs text-blue-300/60 mt-1 tracking-widest uppercase">
              Impermeabilizações
            </p>
            <p className="text-sm text-white/50 mt-3">
              Sistema de Guias de Transporte
            </p>
          </div>

          {/* Login Card */}
          <div
            className={`bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-3xl p-7 shadow-2xl transition-transform ${
              shake ? "animate-[shake_0.5s_ease-in-out]" : ""
            }`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Shield className="size-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Acesso Seguro</h2>
                <p className="text-white/40 text-xs">Introduza a password para continuar</p>
              </div>
            </div>

            <form onSubmit={handle} className="space-y-5">
              <div>
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative mt-2">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/30" />
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="h-13 w-full rounded-xl bg-white/[0.07] border border-white/10 pl-11 pr-12 text-white text-base outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30 transition placeholder:text-white/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-white/60 transition"
                  >
                    {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <button
                disabled={busy}
                className="w-full h-13 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-base hover:from-blue-500 hover:to-blue-400 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-5 animate-spin" /> A verificar...
                  </>
                ) : (
                  <>
                    <Lock className="size-4" /> Entrar
                  </>
                )}
              </button>

              {attempts > 0 && (
                <p className="text-xs text-red-400/70 text-center">
                  {attempts} tentativa{attempts > 1 ? "s" : ""} falhada{attempts > 1 ? "s" : ""}
                </p>
              )}
            </form>
          </div>

          {/* Install Button */}
          <div className="mt-5">
            <InstallAppButton variant="full" />
          </div>

          <p className="mt-6 text-center text-xs text-white/20">
            Prudêncio Checklist v2.0 — Sistema protegido
          </p>
        </div>
      </div>
    </main>
  );
}
