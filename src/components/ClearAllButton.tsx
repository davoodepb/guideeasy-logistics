// ClearAllButton.tsx — Botão "Limpar Tudo" com 3 camadas de segurança.
// Camada 1: Só aparece para o chef (nome configurável)
// Camada 2: Primeiro aviso — "Esta ação é irreversível"
// Camada 3: Tem de escrever APAGAR para confirmar
import { useState } from "react";
import { clearAllData, type ClearResult } from "@/lib/clear-all";
import {
  Trash2,
  X,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Loader2,
} from "lucide-react";

// ← Muda aqui o nome exato do chef (case-insensitive na comparação)
const NOME_CHEF = "Renato";

type Props = {
  /** Nome do utilizador atual (da sessão) */
  nomeUtilizador: string;
  /** Chamado após limpar tudo com sucesso */
  onClearComplete?: () => void;
};

export function ClearAllButton({ nomeUtilizador, onClearComplete }: Props) {
  const [step, setStep] = useState<"idle" | "warn" | "confirm" | "clearing" | "done">("idle");
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<ClearResult | null>(null);

  // ─── Camada 1: Só o chef vê o botão ──────────────────────────────
  const isChef =
    nomeUtilizador.trim().toLowerCase() === NOME_CHEF.toLowerCase();
  if (!isChef) return null;

  function reset() {
    setStep("idle");
    setConfirmText("");
    setResult(null);
  }

  async function executeClear() {
    setStep("clearing");
    try {
      const res = await clearAllData();
      setResult(res);
      setStep("done");
    } catch (err) {
      console.error("[ClearAll] Erro:", err);
      setStep("idle");
    }
  }

  function handleDone() {
    reset();
    onClearComplete?.();
  }

  const canConfirm = confirmText.trim().toUpperCase() === "APAGAR";

  return (
    <>
      {/* ── Botão principal ── */}
      {step === "idle" && (
        <button
          onClick={() => setStep("warn")}
          className="w-full h-12 rounded-2xl bg-red-50 border-2 border-red-200/60 text-red-600 font-semibold flex items-center justify-center gap-2 text-sm hover:bg-red-100 hover:border-red-300 transition-all active:scale-[0.98]"
        >
          <ShieldAlert className="size-4" />
          🧹 Limpar Tudo (Chef)
        </button>
      )}

      {/* ═══ MODAL OVERLAY ═══ */}
      {(step === "warn" || step === "confirm" || step === "clearing" || step === "done") && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-5"
          onClick={() => {
            if (step !== "clearing") reset();
          }}
        >
          <div
            className="bg-card rounded-3xl w-full max-w-sm shadow-2xl border overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Step: WARN (Camada 2) ── */}
            {step === "warn" && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-2xl bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="size-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        Limpar Tudo
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Ação irreversível
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={reset}
                    className="size-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5">
                  <p className="text-sm text-red-800 font-medium mb-2">
                    ⚠️ Esta ação vai apagar permanentemente:
                  </p>
                  <ul className="text-sm text-red-700 space-y-1.5 ml-1">
                    <li className="flex items-center gap-2">
                      <Trash2 className="size-3.5 shrink-0" /> Todas as
                      checklists (guias)
                    </li>
                    <li className="flex items-center gap-2">
                      <Trash2 className="size-3.5 shrink-0" /> Todos os artigos
                    </li>
                    <li className="flex items-center gap-2">
                      <Trash2 className="size-3.5 shrink-0" /> Todos os
                      utilizadores registados
                    </li>
                    <li className="flex items-center gap-2">
                      <Trash2 className="size-3.5 shrink-0" /> Todos os dados no
                      Firebase
                    </li>
                  </ul>
                </div>

                <p className="text-xs text-muted-foreground mb-5">
                  A base de dados ficará como no primeiro dia. Esta ação{" "}
                  <strong>não pode ser revertida</strong>.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={reset}
                    className="h-12 rounded-xl bg-muted font-semibold text-sm transition hover:bg-muted/80"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setStep("confirm")}
                    className="h-12 rounded-xl bg-red-600 text-white font-semibold text-sm transition hover:bg-red-500 flex items-center justify-center gap-2"
                  >
                    <AlertTriangle className="size-4" /> Continuar
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: CONFIRM (Camada 3) ── */}
            {step === "confirm" && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-2xl bg-red-600 flex items-center justify-center">
                      <ShieldAlert className="size-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        Confirmação Final
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Escreva APAGAR para confirmar
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={reset}
                    className="size-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  Para confirmar que quer apagar{" "}
                  <strong>todos os dados</strong>, escreva a palavra{" "}
                  <span className="font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                    APAGAR
                  </span>{" "}
                  no campo abaixo:
                </p>

                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Escreva APAGAR aqui..."
                  autoFocus
                  className="w-full h-13 rounded-xl border-2 border-red-200 bg-red-50/50 px-4 text-center text-lg font-bold tracking-widest text-red-700 uppercase outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition placeholder:text-red-300 placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-sm"
                />

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button
                    onClick={() => setStep("warn")}
                    className="h-12 rounded-xl bg-muted font-semibold text-sm transition hover:bg-muted/80"
                  >
                    ← Voltar
                  </button>
                  <button
                    onClick={executeClear}
                    disabled={!canConfirm}
                    className="h-12 rounded-xl bg-red-600 text-white font-semibold text-sm transition hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Trash2 className="size-4" /> Apagar Tudo
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: CLEARING (loading) ── */}
            {step === "clearing" && (
              <div className="p-8 flex flex-col items-center justify-center gap-4">
                <div className="size-14 rounded-2xl bg-red-100 flex items-center justify-center">
                  <Loader2 className="size-7 text-red-600 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-foreground">
                    A apagar todos os dados...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supabase + Firebase — não feche a app
                  </p>
                </div>
              </div>
            )}

            {/* ── Step: DONE (resultado) ── */}
            {step === "done" && result && (
              <div className="p-6">
                <div className="flex flex-col items-center text-center mb-5">
                  <div className="size-14 rounded-2xl bg-green-100 flex items-center justify-center mb-3">
                    <CheckCircle2 className="size-7 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">
                    Tudo Limpo! 🧹
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Base de dados como no primeiro dia
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2 mb-5">
                  <p className="text-sm text-green-800 flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>
                      <strong>{result.checklists}</strong> checklists apagadas
                    </span>
                  </p>
                  <p className="text-sm text-green-800 flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>
                      <strong>{result.items}</strong> artigos apagados
                    </span>
                  </p>
                  <p className="text-sm text-green-800 flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>
                      <strong>{result.users}</strong> utilizadores apagados
                    </span>
                  </p>
                  <p className="text-sm text-green-800 flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>
                      Firebase{" "}
                      {result.firebaseCleaned ? "limpo ✅" : "⚠️ erro parcial"}
                    </span>
                  </p>
                </div>

                <button
                  onClick={handleDone}
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="size-4" /> Voltar ao Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
