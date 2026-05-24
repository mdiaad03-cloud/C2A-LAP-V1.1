import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("framer-motion")) {
              return "vendor-framer";
            }
            if (id.includes("lucide-react")) {
              return "vendor-lucide";
            }
            return "vendor-core";
          }
          if (id.includes("src/sections/")) {
            return "admin-sections";
          }
          if (id.includes("src/store/")) {
            return "store-modules";
          }
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5500,
    strictPort: true,
    allowedHosts: [".trycloudflare.com", "localhost", "127.0.0.1"],
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5500,
    strictPort: true,
  },
});
