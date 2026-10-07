/**
 * vite.config.ts
 * Vite build and dev server config for the web app. Tailwind CSS v4 runs as a
 * Vite plugin (no PostCSS config), and "@/..." resolves to src/ so shadcn and
 * React Bits imports work. The @fbla/shared workspace is TypeScript source that
 * Vite compiles directly.
 */
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

const DEV_PORT = 5173;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    port: DEV_PORT,
    strictPort: true
  },
  preview: {
    port: 4173,
    strictPort: true
  },
  build: {
    // No public source maps in production (they expose internal file structure).
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split large vendors so they cache independently between deploys.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("firebase") || id.includes("@firebase")) return "firebase";
          if (id.includes("gsap")) return "gsap";
          if (id.includes("motion")) return "motion";
          if (id.includes("react-router") || id.includes("react-dom") || id.includes("scheduler")) {
            return "react-vendor";
          }
          return undefined;
        }
      }
    }
  }
});
