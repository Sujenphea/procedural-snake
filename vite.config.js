import { defineConfig } from "vite"

export default defineConfig({
  base: "./",
  root: "./src",
  publicDir: "../public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ["console.log", "console.warn", "console.info"],
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"], // Separate Three.js into its own chunk for better caching
        },
      },
    },
    sourcemap: false, // Disable sourcemaps in production for smaller bundle
    reportCompressedSize: true,
  },
  server: {
    port: 5173,
    open: true,
  },
})
