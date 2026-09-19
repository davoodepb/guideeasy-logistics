import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";

import { InstallAppButton } from "@/components/InstallAppButton";
import { AuthProvider, useAuth } from "@/lib/session";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("Critical Runtime Error:", error);
  const router = useRouter();

  function clearCacheAndReset() {
    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
      if ("caches" in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      window.location.href = "/";
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-md bg-card border rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-scale-in">
        <div className="size-16 mx-auto bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shadow-inner">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Algo correu mal</h1>
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro inesperado ao carregar a aplicação. Os seus dados estão seguros.
          </p>
        </div>

        <div className="bg-red-50 text-red-800 p-3 rounded-xl text-xs font-mono text-left overflow-hidden text-ellipsis whitespace-nowrap">
          {error.message || "Erro desconhecido"}
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Tentar Novamente
          </button>

          <Link
            to="/"
            className="w-full h-12 rounded-xl bg-secondary text-secondary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Voltar ao Início
          </Link>

          <button
            onClick={clearCacheAndReset}
            className="w-full h-12 rounded-xl border-2 border-muted text-muted-foreground font-semibold flex items-center justify-center gap-2 hover:bg-muted/50 transition active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" />
              <line x1="14" x2="14" y1="11" y2="17" />
            </svg>
            Limpar Cache e Resolver
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Prudêncio — Gestão de Guias de Transporte" },
      {
        name: "description",
        content:
          "PWA para gestão de Guias de Transporte e Obras: PDF, extração OCR, QR Code, Excel e WhatsApp.",
      },
      { name: "theme-color", content: "#0a2540" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      { name: "apple-mobile-web-app-title", content: "Prudêncio" },
      {
        property: "og:title",
        content: "Prudêncio — Gestão de Guias de Transporte",
      },
      {
        property: "og:description",
        content:
          "PWA para gestão de Guias de Transporte e Obras: PDF, extração OCR, QR Code, Excel e WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon-512.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        <HeadContent />
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "window.deferredPrompt = null; window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.deferredPrompt = e; });",
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SplashScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a2540] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Luzes de fundo */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#3b82f6]/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] bg-[#10b981]/6 rounded-full blur-[100px] pointer-events-none" />

      <div className="flex flex-col items-center text-center relative z-10">
        <div className="relative mb-5 scale-95">
          <div className="absolute inset-0 bg-[#3b82f6]/30 rounded-2xl blur-xl animate-pulse" />
          <img
            src="/icon-512.png"
            alt="Prudêncio"
            className="relative size-24 rounded-2xl shadow-2xl ring-2 ring-white/10 animate-scale-in"
          />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Prudêncio</h1>
        <p className="text-xs text-blue-300/60 mt-1.5 tracking-widest uppercase">
          Impermeabilizações
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="size-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-white/40 tracking-wider">A carregar sistema seguro...</p>
        </div>
      </div>
    </div>
  );
}

function AuthLayout() {
  const { loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <>
      <Outlet />
      <div className="fixed bottom-5 right-5 z-50">
        <InstallAppButton />
      </div>
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    // Force hide Lovable badge if it gets injected
    if (typeof window !== "undefined") {
      const hideBadge = () => {
        document.querySelectorAll<HTMLElement>("div, iframe, a").forEach((el) => {
          const id = el.id.toLowerCase();
          const className = typeof el.className === "string" ? el.className.toLowerCase() : "";
          const src = "src" in el && typeof el.src === "string" ? el.src : "";
          if (
            id.includes("lovable") ||
            className.includes("lovable") ||
            src.includes("lovable") ||
            (el.textContent &&
              el.textContent.includes("Edit with") &&
              el.textContent.includes("Lovable"))
          ) {
            el.style.setProperty("display", "none", "important");
            el.style.setProperty("opacity", "0", "important");
            el.style.setProperty("z-index", "-9999", "important");
            el.style.setProperty("pointer-events", "none", "important");
          }
        });
      };

      hideBadge();
      setInterval(hideBadge, 500);
    }
    // Register PWA service worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW registration failed:", err);
      });
    }
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthLayout />
      </AuthProvider>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
