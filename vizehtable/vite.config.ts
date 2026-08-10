/// <reference types="vitest" />
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Firebase Hosting serves from the domain root, but "./" keeps the build
  // portable to a subfolder too (the parent project's GitHub Pages plan).
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Firebase is the single biggest dependency and it almost never
        // changes; splitting it out means an app-code deploy doesn't force
        // every returning visitor to re-download it. This audience arrives
        // from a video description on a phone, so the transfer actually
        // matters.
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/storage"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  test: {
    // Pinned to this directory rather than left relative. irishtable lives
    // inside the parent project's repo, and a relative setup path resolves
    // against the outer root instead of this one.
    root: __dirname,
    environment: "jsdom",
    globals: true,
    setupFiles: [path.resolve(__dirname, "./test/setup.ts")],
  },
});
