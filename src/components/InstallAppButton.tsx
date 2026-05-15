import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

export function InstallAppButton({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    setIsStandalone(isStandaloneMode);

    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone) return null;

  async function handleInstall() {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") {
        toast.success("App instalada com sucesso!");
        setInstallPrompt(null);
      }
    } else if (isIOS) {
      toast.info("Para instalar no iOS: toque no ícone de Partilhar e selecione 'Adicionar ao Ecrã Principal'.", { duration: 5000 });
    } else {
      toast.info("A instalação da App não está disponível no browser atual ou já se encontra instalada.", { duration: 5000 });
    }
  }

  if (variant === "full") {
    return (
      <button
        onClick={handleInstall}
        className="mt-4 w-full h-12 rounded-xl bg-secondary/20 border-2 border-secondary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-secondary/30 transition"
      >
        <Download className="size-5" />
        Instalar App no Telemóvel
      </button>
    );
  }

  return (
    <button
      onClick={handleInstall}
      className="size-10 rounded-full bg-secondary/30 flex items-center justify-center hover:bg-secondary/50 transition-colors"
      aria-label="Instalar App"
      title="Instalar App"
    >
      <Download className="size-5 text-primary-foreground" />
    </button>
  );
}
