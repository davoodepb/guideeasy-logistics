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
import { initAnalytics } from "@/lib/firebase";
import { InstallAppButton } from "@/components/InstallAppButton";

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
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo correu mal</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1, viewport-fit=cover",
        },
        { title: "Prudêncio Checklist — Guias de Transporte" },
        {
          name: "description",
          content:
            "PWA para automação de Guias de Transporte: PDF → Checklist → WhatsApp → Mobile.",
        },
        { name: "theme-color", content: "#0a2540" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "black-translucent",
        },
        { name: "apple-mobile-web-app-title", content: "Prudêncio" },
        {
          property: "og:title",
          content: "Prudêncio Checklist — Guias de Transporte",
        },
        {
          property: "og:description",
          content:
            "PWA para automação de Guias de Transporte: PDF → Checklist → WhatsApp → Mobile.",
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
        } as any,
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
  },
);

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        <HeadContent />
        <script
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    initAnalytics();
    // Force hide Lovable badge if it gets injected
    if (typeof window !== "undefined") {
      const hideBadge = () => {
        document.querySelectorAll("div, iframe, a").forEach((el: any) => {
          if (
            (el.id && el.id.toLowerCase().includes("lovable")) ||
            (el.className &&
              typeof el.className === "string" &&
              el.className.toLowerCase().includes("lovable")) ||
            (el.src && el.src.includes("lovable")) ||
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
      <Outlet />
      <div className="fixed bottom-5 right-5 z-50">
        <InstallAppButton />
      </div>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
