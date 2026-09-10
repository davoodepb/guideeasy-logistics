import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

if (process.env.VERCEL) {
  process.env.SERVER_PRESET = "vercel";
}

// TanStack Start entry — aponta para o wrapper SSR de erros.
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      port: 8433,
      strictPort: false,
      open: true,
    },
    plugins: [
      nitro({
        preset: "vercel",
      }),
    ],
  },
});
