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

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Prudêncio Checklist — Guias de Transporte" },
      {
        name: "description",
        content: "PWA para automação de Guias de Transporte: PDF → Checklist → WhatsApp → Mobile.",
      },
      { name: "theme-color", content: "#0a2540" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Prudêncio" },
      { property: "og:title", content: "Prudêncio Checklist — Guias de Transporte" },
      {
        property: "og:description",
        content: "PWA para automação de Guias de Transporte: PDF → Checklist → WhatsApp → Mobile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Prudêncio Checklist — Guias de Transporte" },
      {
        name: "twitter:description",
        content: "PWA para automação de Guias de Transporte: PDF → Checklist → WhatsApp → Mobile.",
      },
      { name: "twitter:card", content: "summary" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/edd4210b-188a-4153-8e81-ca6d5fba171d/id-preview-432c1843--10f8940c-ad82-4bcd-8804-996d73a935eb.lovable.app-1778804025924.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/edd4210b-188a-4153-8e81-ca6d5fba171d/id-preview-432c1843--10f8940c-ad82-4bcd-8804-996d73a935eb.lovable.app-1778804025924.png" },
    ],
    links: [
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
