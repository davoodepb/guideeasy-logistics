import { useState, useEffect, useCallback } from "react";
import { Download, Share, X, Smartphone, Monitor, Apple, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void> | void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    deferredPrompt: BeforeInstallPromptEvent | null;
    MSStream?: unknown;
  }
}

export function InstallAppButton({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Mark as mounted to avoid hydration mismatch
    setIsMounted(true);

    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;
    setIsStandalone(standalone);

    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !window.MSStream);
    setIsAndroid(/android/i.test(ua));

    // Use already-captured prompt from RootShell script
    const prompt = window.deferredPrompt;
    if (prompt) {
      setInstallPrompt(prompt);
    }

    const capturePrompt = (event: Event) => {
      if (!("prompt" in event) || !("userChoice" in event)) return;
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setInstallPrompt(promptEvent);
      window.deferredPrompt = promptEvent;
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      window.deferredPrompt = null;
      setIsStandalone(true);
      toast.success("Aplicação instalada. Pode fechar o browser.");
    };

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = installPrompt || window.deferredPrompt;

    if (prompt) {
      setInstalling(true);
      try {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === "accepted") {
          toast.success("Aplicação instalada com sucesso.");
          setInstallPrompt(null);
          window.deferredPrompt = null;
        } else {
          toast("Instalação cancelada. Pode instalar mais tarde.");
        }
      } catch (err) {
        console.error("[PWA] Install error:", err);
        setInstallPrompt(null);
        window.deferredPrompt = null;
        showFallbackInstructions();
      } finally {
        setInstalling(false);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else if (isAndroid) {
      toast(
        <div className="flex flex-col gap-3">
          <p className="font-bold text-base">Instalar no Android</p>
          <div className="space-y-2 text-sm">
            <p>
              <strong>1.</strong> Toque nos <strong>3 pontos</strong> no canto superior direito
            </p>
            <p>
              <strong>2.</strong> Toque em <strong>"Instalar aplicação"</strong>
            </p>
            <p>
              <strong>3.</strong> Confirme tocando em <strong>"Instalar"</strong>
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
            Se abriu pelo WhatsApp ou Instagram, copie o link e abra no <strong>Chrome</strong>.
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
        <p className="font-bold text-base">Instalar no {browser}</p>
        <div className="space-y-2 text-sm">
          <p>
            <strong>1.</strong> Na barra de endereço, procure o ícone de instalação
          </p>
          <p>
            <strong>2.</strong> Clique nesse ícone e escolha <strong>"Instalar"</strong>
          </p>
          <p>
            <strong>3.</strong> A aplicação abre como programa independente
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">
          Se não vê o ícone: Menu — <strong>"Instalar Prudêncio"</strong>
        </div>
      </div>,
      { duration: 15000 },
    );
  }

  const isBrowser = typeof window !== "undefined";
  const hasPrompt = !!(installPrompt || (isBrowser && window.deferredPrompt));

  // Avoid hydration mismatch: render placeholder until mounted
  if (!isMounted) {
    return variant === "full" ? (
      <button disabled className="w-full h-14 rounded-xl bg-muted/30" />
    ) : (
      <button disabled className="size-12 rounded-full bg-muted/30" />
    );
  }

  if (isStandalone) {
    const label = "Aplicação instalada";
    if (variant === "full") {
      return (
        <button
          disabled
          className="w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition shadow-lg bg-green-50 text-green-700 opacity-80 cursor-not-allowed"
        >
          <CheckCircle2 className="size-5" />
          {label}
        </button>
      );
    }
    return (
      <button
        disabled
        className="size-12 rounded-full shadow-lg flex items-center justify-center bg-green-50 text-green-700 opacity-80 cursor-not-allowed"
        title={label}
      >
        <Monitor className="size-5" />
      </button>
    );
  }

  const labelText = hasPrompt
    ? "Instalar Aplicação"
    : isIOS
      ? "Instalar no iPhone"
      : isAndroid
        ? "Instalar no Android"
        : "Instalar Aplicação";

  const Icon = hasPrompt ? Download : isIOS ? Apple : isAndroid ? Smartphone : Monitor;

  return (
    <>
      {variant === "full" ? (
        <button
          onClick={handleInstall}
          disabled={installing}
          className={`w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition shadow-lg active:scale-[0.98] ${
            hasPrompt
              ? "bg-linear-to-r from-green-600 to-emerald-500 text-white shadow-green-500/25 hover:from-green-500 hover:to-emerald-400"
              : "bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/25 hover:from-blue-500 hover:to-indigo-500"
          } disabled:opacity-60`}
        >
          {installing ? (
            <span className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon className="size-5" />
          )}
          {labelText}
        </button>
      ) : (
        <button
          onClick={handleInstall}
          disabled={installing}
          className={`size-12 rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all ${
            hasPrompt
              ? "bg-linear-to-br from-green-600 to-emerald-500 text-white shadow-green-500/30"
              : "bg-linear-to-br from-blue-600 to-indigo-600 text-white shadow-blue-500/30"
          }`}
          aria-label="Instalar Aplicação"
          title={labelText}
        >
          {installing ? (
            <span className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon className="size-5" />
          )}
        </button>
      )}

      {/* Modal de instalação iOS — shadcn/ui AlertDialog */}
      <AlertDialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <AlertDialogContent className="max-w-sm rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Apple className="size-5" />
              Instalar no iPhone
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                <div className="space-y-3">
                  <IOSStep num={1}>
                    Toque no ícone de <strong>Partilhar</strong>{" "}
                    <Share className="size-4 inline text-blue-600 align-text-bottom" /> na barra
                    inferior do Safari
                  </IOSStep>
                  <IOSStep num={2}>
                    Deslize para baixo e toque em{" "}
                    <strong className="text-blue-600">"Adicionar ao Ecrã Principal"</strong>
                  </IOSStep>
                  <IOSStep num={3}>
                    Toque em <strong className="text-green-600">"Adicionar"</strong> no canto
                    superior direito
                  </IOSStep>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  <strong>Nota:</strong> Use o <strong>Safari</strong> para instalar. O Chrome e
                  Firefox não suportam instalação PWA no iOS.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowIOSModal(false)}
              className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500"
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function IOSStep({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="size-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md">
        {num}
      </div>
      <p className="text-sm text-gray-700 pt-1.5">{children}</p>
    </div>
  );
}
