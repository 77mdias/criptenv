import { cloudflare } from "@cloudflare/vite-plugin";
import rsc from "@vitejs/plugin-rsc";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import vinext from "vinext";

export default defineConfig({
  plugins: [
    vinext({ rsc: false }),
    rsc({
      entries: {
        rsc: "virtual:vinext-rsc-entry",
        ssr: "virtual:vinext-app-ssr-entry",
        client: "virtual:vinext-app-browser-entry",
      },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  resolve: {
    alias: {
      // Jest-only alias (@messages → messages/) also known to Vite, so the
      // dependency scanner does not abort pre-bundling when it reaches test
      // files that import catalogues directly (a failed scan leaves
      // NextIntlClientProvider's virtual proxy un-bundled and crashes the
      // browser at runtime — seen in CI).
      "@messages": fileURLToPath(new URL("./messages", import.meta.url)),
    },
  },
  optimizeDeps: {
    entries: [
      "src/**/*.{ts,tsx}",
      "!src/**/__tests__/**",
      "!cypress/**",
    ],
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
