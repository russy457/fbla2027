/**
 * vite.config.ts
 * Vite build and dev server config for the web app. Tailwind CSS v4 runs as a
 * Vite plugin (no PostCSS config), and "@/..." resolves to src/ so shadcn and
 * React Bits imports work. The @fbla/shared workspace is TypeScript source that
 * Vite compiles directly.
 * Tier 2 lane C: APP_BASE_URL is exposed to the client (canonical URLs) and
 * the build writes robots.txt and sitemap.xml from it (SPEC Tier 3 SEO).
 */
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
// Tier 2 lane C
import { readdirSync } from "node:fs";
import { DEFAULT_BASE_URL, buildRobotsTxt, buildSitemapXml, sitemapPaths } from "./src/lib/seo/sitemap";

const DEV_PORT = 5173;

// Tier 2 lane C: robots.txt + sitemap.xml at build time. Help article slugs are their file names.
const HELP_DIR = fileURLToPath(new URL("./src/content/help", import.meta.url));
const seoFiles = (): Plugin => {
  let configuredBaseUrl = "";
  return {
    name: "fbla-seo-files",
    apply: "build",
    configResolved(config) {
      configuredBaseUrl = String(config.env.APP_BASE_URL ?? "").trim();
    },
    generateBundle() {
      if (configuredBaseUrl === "") {
        this.warn(`APP_BASE_URL is not set: robots.txt and sitemap.xml use ${DEFAULT_BASE_URL}. Set it before a deploy build (docs/DEMO.md).`);
      }
      const baseUrl = configuredBaseUrl || DEFAULT_BASE_URL;
      const slugs = readdirSync(HELP_DIR)
        .filter((name) => name.endsWith(".md"))
        .map((name) => name.slice(0, -".md".length));
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: buildSitemapXml(baseUrl, sitemapPaths(slugs)) });
      this.emitFile({ type: "asset", fileName: "robots.txt", source: buildRobotsTxt(baseUrl) });
    }
  };
};

export default defineConfig({
  plugins: [react(), tailwindcss(), seoFiles() /* Tier 2 lane C */],
  // Tier 2 lane C: APP_BASE_URL (not a secret) is readable as import.meta.env.APP_BASE_URL.
  envPrefix: ["VITE_", "APP_BASE_URL"],
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
          // Tier 2 lane C: the optional map library stays in its own lazily loaded chunk.
          if (id.includes("mapbox-gl")) return "mapbox";
          if (id.includes("react-router") || id.includes("react-dom") || id.includes("scheduler")) {
            return "react-vendor";
          }
          return undefined;
        }
      }
    }
  }
});
