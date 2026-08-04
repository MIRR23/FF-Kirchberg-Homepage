import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/** Adresse des lokalen PHP-Servers während der Entwicklung. */
const PHP_BACKEND = { target: "http://127.0.0.1:8000", changeOrigin: true };

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // Für die Frontend-Entwicklung: PHP-Backend parallel starten mit
    //   php -S 127.0.0.1:8000 -t .
    // Die Anfragen an api.php/datei.php/uploads gehen dann dorthin.
    proxy: {
      "/api.php": PHP_BACKEND,
      "/datei.php": PHP_BACKEND,
      "/uploads": PHP_BACKEND,
    },
  },
});
