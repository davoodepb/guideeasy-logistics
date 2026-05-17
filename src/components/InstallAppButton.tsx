import { useState, useEffect, useCallback } from "react";
import { Download, Share, X, Smartphone, Monitor, Apple } from "lucide-react";
import { toast } from "sonner";

export function InstallAppButton({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
    setIsAndroid(/android/i.test(ua));

    // Capture the deferred prompt event
    const capturePrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      (window as any).deferredPrompt = e;
      console.log("[PWA] Install prompt captured!");
    };

    // Check if prompt was already captured globally
    if ((window as any).deferredPrompt) {
      setInstallPrompt((window as any).deferredPrompt);
    }

    window.addEventListener("beforeinstallprompt", capturePrompt);

    // Listen for successful installation
    window.addEventListener("appinstalled", () => {
      setInstallPrompt(null);
      (window as any).deferredPrompt = null;
      setIsStandalone(true);
      toast.success("✅ App instalada com sucesso! Pode fechar o browser.");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = installPrompt || (window as any).deferredPrompt;

    if (prompt) {
      // REAL install prompt available — trigger it
      setInstalling(true);
      try {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === "accepted") {
          toast.success("✅ App instalada com sucesso!");
          setInstallPrompt(null);
          (window as any).deferredPrompt = null;
        } else {
          toast("Instalação cancelada. Pode instalar mais tarde.");
        }
      } catch (err) {
        console.error("[PWA] Install error:", err);
        // Prompt was already used, clear it
        setInstallPrompt(null);
        (window as any).deferredPrompt = null;
        showFallbackInstructions();
      } finally {
        setInstalling(false);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else if (isAndroid) {
      toast(
        <div className="flex flex-col gap-3">
          <p className="font-bold text-base">📲 Instalar no Android</p>
          <div className="space-y-2 text-sm">
            <p><strong>1.</strong> Toque nos <strong>3 pontos ⋮</strong> no canto superior direito</p>
            <p><strong>2.</strong> Toque em <strong>"Instalar aplicação"</strong></p>
            <p><strong>3.</strong> Confirme tocando em <strong>"Instalar"</strong></p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
            ⚠️ Se abriu pelo WhatsApp ou Instagram, copie o link e abra no <strong>Chrome</strong>.
          </div>
        </div>,
        { duration: 15000 },
      );
    } else {
      showFallbackInstructions();
    }
  }, [installPrompt, isIOS, isAndroid]);

  function showFallbackInstructions() {
    const isChrome = /chrome/i.test(navigator.userAgent) && !/edg/i.test(navigator.userAgent);
    const isEdge = /edg/i.test(navigator.userAgent);
    const browser = isEdge ? "Edge" : isChrome ? "Chrome" : "browser";

    toast(
      <div className="flex flex-col gap-3">
        <p className="font-bold text-base">💻 Instalar no {browser}</p>
        <div className="space-y-2 text-sm">
          <p><strong>1.</strong> Na barra de endereço, procure o ícone <strong>⊕</strong> ou <strong>📥</strong></p>
          <p><strong>2.</strong> Clique nesse ícone e escolha <strong>"Instalar"</strong></p>
          <p><strong>3.</strong> A app abre como programa independente</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">
          💡 Se não vê o ícone: Menu ⋮ → <strong>"Instalar Prudêncio Checklist"</strong>
        </div>
      </div>,
      { duration: 15000 },
    );
  }

  const isBrowser = typeof window !== "undefined";
  const hasPrompt = !!(installPrompt || (isBrowser && (window as any).deferredPrompt));
  
  if (isStandalone) {
    const label = "✅ App Instalada";
    if (variant === "full") {
      return (
        <button disabled className="w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition shadow-lg bg-green-50 text-green-700 opacity-80 cursor-not-allowed">
          <Monitor className="size-5" />
          {label}
        </button>
      );
    }
    return (
      <button disabled className="size-12 rounded-full shadow-lg flex items-center justify-center bg-green-50 text-green-700 opacity-80 cursor-not-allowed" title={label}>
        <Monitor className="size-5" />
      </button>
    );
  }
  const label = hasPrompt
    ? "📥 Instalar Aplicação"
    : isIOS
      ? "🍎 Instalar App iPhone"
      : isAndroid
        ? "📥 Instalar App Android"
        : "💻 Instalar App Desktop";

  const Icon = hasPrompt ? Download : isIOS ? Apple : isAndroid ? Smartphone : Monitor;

  return (
    <>
      {variant === "full" ? (
        <button
          onClick={handleInstall}
          disabled={installing}
          className={`w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition shadow-lg active:scale-[0.98] ${
            hasPrompt
              ? "bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-green-500/25 hover:from-green-500 hover:to-emerald-400"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/25 hover:from-blue-500 hover:to-indigo-500"
          } disabled:opacity-60`}
        >
          {installing ? (
            <span className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon className="size-5" />
          )}
          {label}
        </button>
      ) : (
        <button
          onClick={handleInstall}
          disabled={installing}
          className={`size-12 rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all ${
            hasPrompt
              ? "bg-gradient-to-br from-green-600 to-emerald-500 text-white shadow-green-500/30"
              : "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-blue-500/30"
          }`}
          aria-label="Instalar App"
          title={label}
        >
          {installing ? (
            <span className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon className="size-5" />
          )}
        </button>
      )}

      {/* iOS Install Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4" onClick={() => setShowIOSModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">📲 Instalar no iPhone</h2>
              <button onClick={() => setShowIOSModal(false)} className="size-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
                <X className="size-4 text-gray-600" />
              </button>
            </div>

            <div className="space-y-5">
              <IOSStep num={1}>
                Toque no ícone de <strong>Partilhar</strong>{" "}
                <Share className="size-5 inline text-blue-600 align-text-bottom" />{" "}
                na barra inferior do Safari
              </IOSStep>

              <IOSStep num={2}>
                Deslize para baixo e toque em{" "}
                <strong className="text-blue-600">"Adicionar ao Ecrã Principal"</strong>
              </IOSStep>

              <IOSStep num={3}>
                Toque em <strong className="text-green-600">"Adicionar"</strong> no canto superior direito
              </IOSStep>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <strong>⚠️ Importante:</strong> Use o <strong>Safari</strong> para instalar. Outros browsers (Chrome, Firefox) não suportam PWA no iOS.
            </div>

            <button onClick={() => setShowIOSModal(false)} className="w-full h-13 rounded-xl bg-blue-600 text-white font-bold text-base transition hover:bg-blue-500 active:scale-[0.98]">
              Entendido ✓
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function IOSStep({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="size-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-md">
        {num}
      </div>
      <p className="text-base text-gray-700 pt-1.5">{children}</p>
    </div>
  );
}
