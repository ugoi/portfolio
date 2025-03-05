import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react"],
          "react-dom-vendor": ["react-dom"],
          "hls-vendor": ["hls.js"],
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    chunkSizeWarningLimit: 500,
    target: "esnext",
    minify: "esbuild",
    cssMinify: true,
    modulePreload: {
      polyfill: false, // Reduces polyfill code if you don't need legacy browser support
    },
    reportCompressedSize: false, // Speeds up build
  },
  server: {
    host: true, // Listen on all network interfaces
    port: 5173,
  },
});
