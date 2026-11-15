import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { InstallAppButton } from "@/components/InstallAppButton";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({ meta: [{ title: "Prudêncio — Sistema de Gestão" }] }),
});

function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/dashboard" });
  }, [navigate]);

  return (
    <main className="min-h-[100dvh] bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a2540] px-5 py-10 flex flex-col relative overflow-hidden">
      {/* Luzes de fundo */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#3b82f6]/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] bg-[#10b981]/6 rounded-full blur-[100px] pointer-events-none" />

      <div className="flex-1 flex items-center justify-center relative z-10 animate-fade-in">
        <div className="w-full max-w-sm text-center">
          {/* Logótipo */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-3">
              <div className="absolute inset-0 bg-[#3b82f6]/30 rounded-2xl blur-xl animate-pulse" />
              <img
                src="/icon-512.png"
                alt="Prudêncio Impermeabilizações"
                className="relative size-20 rounded-2xl shadow-2xl ring-2 ring-white/10"
              />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">Prudêncio</h1>
            <p className="text-xs text-blue-300/60 mt-1 tracking-widest uppercase">
              Impermeabilizações
            </p>
            <p className="text-sm text-white/50 mt-3">A carregar...</p>
          </div>

          {/* Instalar aplicação */}
          <div className="mt-5">
            <InstallAppButton variant="full" />
          </div>
        </div>
      </div>
    </main>
  );
}
