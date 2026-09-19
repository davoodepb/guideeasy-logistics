/**
 * ═══════════════════════════════════════════════════════════════
 * Rota /firebase-test — Página de Diagnóstico Firebase
 *
 * Acede a http://localhost:8433/firebase-test para verificar
 * se todos os serviços Firebase estão configurados e a funcionar.
 *
 * ⚠️ REMOVE esta rota em produção!
 * ═══════════════════════════════════════════════════════════════
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { app, auth, firebaseConfigStatus, firestore, storage } from "@/lib/firebase";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";

export const Route = createFileRoute("/firebase-test")({
  component: FirebaseTestPage,
  head: () => ({ meta: [{ title: "🔥 Firebase Test — Prudêncio" }] }),
});

// ─── Tipos ───────────────────────────────────────────────────────────

type TestStatus = "idle" | "running" | "pass" | "fail";

interface TestResult {
  name: string;
  icon: string;
  status: TestStatus;
  message: string;
  durationMs?: number;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "UNKNOWN";
}

// ─── Componente Principal ────────────────────────────────────────────

function FirebaseTestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateResult = useCallback((index: number, update: Partial<TestResult>) => {
    setResults((prev) => prev.map((r, i) => (i === index ? { ...r, ...update } : r)));
  }, []);

  const runTests = useCallback(async () => {
    setIsRunning(true);

    const initialTests: TestResult[] = [
      {
        name: "Firebase App Initialization",
        icon: "🔧",
        status: "running",
        message: "A verificar...",
      },
      {
        name: "Firebase Authentication",
        icon: "🔐",
        status: "running",
        message: "A verificar...",
      },
      {
        name: "Cloud Firestore (Read/Write)",
        icon: "📄",
        status: "running",
        message: "A verificar...",
      },
      {
        name: "Histórico de Atividades (activity_log)",
        icon: "🧾",
        status: "running",
        message: "A verificar...",
      },
      {
        name: "Cloud Storage",
        icon: "📦",
        status: "running",
        message: "A verificar...",
      },
    ];
    setResults([...initialTests]);

    // ── Teste 1: Firebase App ──────────────────────────────────
    const t0 = performance.now();
    try {
      const name = app.name;
      const projectId = app.options.projectId;

      if (!firebaseConfigStatus.configured) {
        updateResult(0, {
          status: "fail",
          message:
            "Configuração incompleta. Faltam: " + firebaseConfigStatus.missing.join(", ") + ".",
          durationMs: Math.round(performance.now() - t0),
        });
      } else {
        updateResult(0, {
          status: "pass",
          message: `App "${name}" → projeto "${projectId}" | configuração ✓`,
          durationMs: Math.round(performance.now() - t0),
        });
      }
    } catch (err: unknown) {
      updateResult(0, {
        status: "fail",
        message: getErrorMessage(err),
        durationMs: Math.round(performance.now() - t0),
      });
    }

    // ── Teste 2: Auth ─────────────────────────────────────────
    const t1 = performance.now();
    try {
      if (!auth) throw new Error("Firebase Authentication não está configurado.");
      const authDomain = auth.config.authDomain || "não configurado";
      updateResult(1, {
        status: "pass",
        message: `Auth pronto — authDomain: ${authDomain}`,
        durationMs: Math.round(performance.now() - t1),
      });
    } catch (err: unknown) {
      updateResult(1, {
        status: "fail",
        message: getErrorMessage(err),
        durationMs: Math.round(performance.now() - t1),
      });
    }

    // ── Teste 3: Firestore ────────────────────────────────────
    const t2 = performance.now();
    try {
      if (!auth?.currentUser) {
        throw new Error("Inicie sessão para testar as regras protegidas do Firestore.");
      }
      const testDocRef = doc(firestore, "_connection_test", "firestore-" + crypto.randomUUID());
      const testData = {
        ok: true,
        timestamp: Date.now(),
        source: "firebase-test-page",
      };
      await setDoc(testDocRef, testData);
      const snap = await getDoc(testDocRef);
      if (snap.exists() && snap.data()?.ok === true) {
        await deleteDoc(testDocRef);
        updateResult(2, {
          status: "pass",
          message: "Firestore: write → read → delete — tudo OK ✅",
          durationMs: Math.round(performance.now() - t2),
        });
      } else {
        updateResult(2, {
          status: "fail",
          message:
            "Firestore: documento escrito mas leitura não correspondeu. Verifique as regras de segurança.",
          durationMs: Math.round(performance.now() - t2),
        });
      }
    } catch (err: unknown) {
      const code = getErrorCode(err);
      const hint =
        code === "permission-denied"
          ? " → Publique as regras seguras do Firestore e confirme que a conta tem acesso."
          : code === "unavailable"
            ? " → Verifique se o Firestore está ativado na consola Firebase."
            : "";
      updateResult(2, {
        status: "fail",
        message: `Firestore: [${code}] ${getErrorMessage(err)}${hint}`,
        durationMs: Math.round(performance.now() - t2),
      });
    }

    // ── Teste 4: Histórico ────────────────────────────────────
    const t3 = performance.now();
    try {
      if (!auth?.currentUser) {
        throw new Error("Inicie sessão para testar o Histórico protegido.");
      }

      const profileSnap = await getDoc(doc(firestore, "users", auth.currentUser.uid));
      if (!profileSnap.exists() || profileSnap.data()?.role !== "admin") {
        throw new Error("O teste do Histórico exige role 'admin' em users/{UID}.");
      }

      const testActivityRef = doc(
        firestore,
        "activity_log",
        "firebase-test-" + crypto.randomUUID(),
      );
      try {
        await setDoc(testActivityRef, {
          action: "firebase_test",
          entity_type: "diagnostic",
          entity_name: "Firebase connection test",
          created_at: Date.now(),
        });
        const snap = await getDoc(testActivityRef);
        if (!snap.exists() || snap.data()?.action !== "firebase_test") {
          throw new Error("O registo do Histórico não correspondeu ao registo escrito.");
        }
        updateResult(3, {
          status: "pass",
          message: "activity_log: write → read → delete — tudo OK ✅",
          durationMs: Math.round(performance.now() - t3),
        });
      } finally {
        await deleteDoc(testActivityRef).catch(() => undefined);
      }
    } catch (err: unknown) {
      updateResult(3, {
        status: "fail",
        message: `Histórico: ${getErrorMessage(err)}`,
        durationMs: Math.round(performance.now() - t3),
      });
    }

    // ── Teste 5: Storage ──────────────────────────────────────
    const t4 = performance.now();
    try {
      if (!auth?.currentUser) {
        throw new Error("Inicie sessão para testar o Storage protegido.");
      }
      const testStorRef = storageRef(
        storage,
        "_connection_test/" + auth.currentUser.uid + "/" + crypto.randomUUID() + ".txt",
      );
      const body = "Prudencio Firebase connection test";
      try {
        await uploadBytes(testStorRef, new Blob([body], { type: "text/plain" }));
        const downloadResponse = await fetch(await getDownloadURL(testStorRef));
        if (!downloadResponse.ok || (await downloadResponse.text()) !== body) {
          throw new Error("O ficheiro enviado não corresponde ao ficheiro lido.");
        }
        const bucket = storage.app.options.storageBucket || "não configurado";
        updateResult(4, {
          status: "pass",
          message: "Storage: upload → download → delete — tudo OK | bucket: " + bucket,
          durationMs: Math.round(performance.now() - t4),
        });
      } finally {
        await deleteObject(testStorRef).catch(() => undefined);
      }
    } catch (err: unknown) {
      updateResult(4, {
        status: "fail",
        message: `Storage: ${getErrorMessage(err)}`,
        durationMs: Math.round(performance.now() - t4),
      });
    }

    setIsRunning(false);
  }, [updateResult]);

  // ── Helpers de UI ─────────────────────────────────────────────────

  const statusBadge = (s: TestStatus) => {
    switch (s) {
      case "pass":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
            ✅ PASS
          </span>
        );
      case "fail":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 ring-1 ring-red-500/30">
            ❌ FAIL
          </span>
        );
      case "running":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30 animate-pulse">
            ⏳ A testar...
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/40 ring-1 ring-white/10">
            ⬜ Pendente
          </span>
        );
    }
  };

  const allPassed = results.length > 0 && results.every((r) => r.status === "pass");
  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;

  return (
    <main className="min-h-[100dvh] bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a2540] px-5 py-10 flex flex-col items-center relative overflow-hidden">
      {/* Luzes de fundo */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#f97316]/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] bg-[#3b82f6]/6 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 text-orange-400 text-xs font-semibold ring-1 ring-orange-500/20 mb-4">
            🔧 DIAGNÓSTICO — REMOVER EM PRODUÇÃO
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            🔥 Firebase Connection Test
          </h1>
          <p className="text-sm text-white/40 mt-2">
            Projeto:{" "}
            <span className="text-white/70 font-mono">
              {app.options.projectId || "não configurado"}
            </span>{" "}
            — Project Number: <span className="text-white/70 font-mono">37827545233</span>
          </p>
        </div>

        {/* Painel de configuração */}
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
            📋 Configuração Detetada
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ["projectId", app.options.projectId],
              ["authDomain", app.options.authDomain],
              ["storageBucket", app.options.storageBucket],
              ["messagingSenderId", app.options.messagingSenderId],
              ["apiKey", app.options.apiKey ? "configurada" : "⚠️ VAZIO"],
              [
                "appId",
                app.options.appId ? "••••" + (app.options.appId as string).slice(-8) : "⚠️ VAZIO",
              ],
              ["databaseURL", app.options.databaseURL || "não definido"],
            ].map(([key, val]) => (
              <div
                key={key}
                className="flex justify-between items-center bg-white/[0.03] rounded-lg px-3 py-2"
              >
                <span className="text-white/40 font-mono">{key}</span>
                <span
                  className={`font-mono ${
                    String(val).includes("VAZIO") ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Botão de arranque */}
        <div className="flex justify-center mb-6">
          <button
            onClick={runTests}
            disabled={isRunning}
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold text-base hover:from-orange-500 hover:to-amber-400 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-wait shadow-lg shadow-orange-500/25 flex items-center gap-2.5"
          >
            {isRunning ? (
              <>
                <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                A executar testes...
              </>
            ) : (
              <>🚀 Executar Todos os Testes</>
            )}
          </button>
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((r, i) => (
              <div
                key={i}
                className={`bg-white/[0.04] backdrop-blur border rounded-xl p-4 transition-all duration-300 ${
                  r.status === "pass"
                    ? "border-emerald-500/30"
                    : r.status === "fail"
                      ? "border-red-500/30"
                      : "border-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{r.icon}</span>
                    <span className="text-sm font-semibold text-white">{r.name}</span>
                    {r.durationMs !== undefined && (
                      <span className="text-xs text-white/30 font-mono">{r.durationMs}ms</span>
                    )}
                  </div>
                  {statusBadge(r.status)}
                </div>
                <p
                  className={`text-xs leading-relaxed pl-8 ${
                    r.status === "fail" ? "text-red-400" : "text-white/50"
                  }`}
                >
                  {r.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Resumo final */}
        {results.length > 0 && !isRunning && (
          <div className="mt-6">
            {allPassed ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-2">🎉</div>
                <h2 className="text-xl font-bold text-emerald-400">
                  Firebase Conectado com Sucesso!
                </h2>
                <p className="text-sm text-emerald-300/60 mt-1">
                  Todos os {results.length} serviços estão operacionais. Já podes remover esta
                  página de teste.
                </p>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-2">⚠️</div>
                <h2 className="text-xl font-bold text-red-400">
                  {failCount} teste{failCount > 1 ? "s" : ""} falharam, {passCount} passaram
                </h2>
                <div className="text-sm text-red-300/80 mt-3 text-left space-y-1.5">
                  <p>
                    <strong>💡 Checklist de resolução:</strong>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>
                      Verifica que colaste{" "}
                      <code className="text-amber-400">VITE_FIREBASE_API_KEY</code> e{" "}
                      <code className="text-amber-400">VITE_FIREBASE_APP_ID</code> no ficheiro{" "}
                      <code>.env</code>
                    </li>
                    <li>
                      Na consola Firebase, ativa os serviços que falharam (Firestore e Storage)
                    </li>
                    <li>
                      Se houver "permission-denied", publique as regras seguras do projeto Firebase.
                    </li>
                    <li>Reinicia o dev server após alterar o .env</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Link de volta */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-xs text-white/30 hover:text-white/60 transition underline underline-offset-4"
          >
            ← Voltar ao login
          </a>
        </div>
      </div>
    </main>
  );
}
