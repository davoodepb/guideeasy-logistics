import { useState, useEffect } from "react";
import { Download, Share, MoreVertical } from "lucide-react";
import { toast } from "sonner";

export function InstallAppButton({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    setIsStandalone(isStandaloneMode);

    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
    setIsAndroid(/android/i.test(ua));

    // Try to grab globally stashed prompt if it fired early
    if ((window as any).deferredPrompt) {
      setInstallPrompt((window as any).deferredPrompt);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      (window as any).deferredPrompt = e;
    };
    
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone) return null;

  async function handleInstall() {
    const promptEvent = installPrompt || (window as any).deferredPrompt;
    
    if (promptEvent) {
      promptEvent.prompt();
      const result = await promptEvent.userChoice;
      if (result.outcome === "accepted") {
        toast.success("App instalada com sucesso!");
        setInstallPrompt(null);
        (window as any).deferredPrompt = null;
      }
    } else if (isIOS) {
      toast(
        <div className="flex flex-col gap-2">
          <p className="font-bold">Instalar no ecrã principal (iOS)</p>
          <div className="flex items-center gap-2 text-sm">1. Toque no ícone de partilha <Share className="size-4 border rounded p-0.5" /> abaixo.</div>
          <div className="flex items-center gap-2 text-sm">2. Escolha "Adicionar ao Ecrã Principal".</div>
        </div>, 
        { duration: 10000 }
      );
    } else if (isAndroid) {
      toast(
        <div className="flex flex-col gap-2">
          <p className="font-bold">Instalação Manual (Android)</p>
          <div className="flex items-center gap-2 text-sm">1. Toque no menu do browser <MoreVertical className="size-4" /> (3 pontos).</div>
          <div className="flex items-center gap-2 text-sm">2. Escolha "Instalar aplicação" ou "Adicionar ao ecrã principal".</div>
          <p className="text-xs mt-1 text-muted-foreground">Se abriu a partir do WhatsApp/Instagram, copie o link e abra no Google Chrome de forma nativa.</p>
        </div>, 
        { duration: 12000 }
      );
    } else {
      toast(
        <div className="flex flex-col gap-2">
          <p className="font-bold">Instalar App no Computador</p>
          <p className="text-sm">Procure o ícone de instalação (computador com uma seta) na barra de endereço do Chrome/Edge, perto da estrela de favoritos.</p>
        </div>, 
        { duration: 8000 }
      );
    }
  }

  if (variant === "full") {
    return (
      <button
        onClick={handleInstall}
        className="mt-4 w-full h-12 rounded-xl bg-secondary/20 border-2 border-secondary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-secondary/30 transition shadow-sm"
      >
        <Download className="size-5" />
        Instalar App no Telemóvel
      </button>
    );
  }

  return (
    <button
      onClick={handleInstall}
      className="size-10 rounded-full bg-secondary text-secondary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
      aria-label="Instalar App"
      title="Instalar App"
    >
      <Download className="size-5" />
    </button>
  );
}
