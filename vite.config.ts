import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// TanStack Start entry — points to our SSR error wrapper.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      port: 2343,
      strictPort: false,
    },
  },
});
