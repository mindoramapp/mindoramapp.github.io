import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// The production CSP forbids inline scripts. Vite's dev server injects one (React Fast Refresh),
// so only the local dev server relaxes script-src; builds keep the strict policy.
const devInlineScripts = (): Plugin => ({
  name: "mindora-dev-csp",
  apply: "serve",
  transformIndexHtml: (html) =>
    html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';"),
});

export default defineConfig({
  base: "./",
  plugins: [
    // Must run before react(): generates src/routeTree.gen.ts and splits each route into its own chunk.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    devInlineScripts(),
  ],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          router: ["@tanstack/react-router"],
          supabase: ["@supabase/supabase-js"],
          reactflow: ["reactflow"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
