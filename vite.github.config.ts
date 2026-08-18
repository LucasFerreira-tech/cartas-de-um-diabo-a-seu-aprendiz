import { fileURLToPath } from "node:url";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(projectRoot, "github"),
  publicDir: path.join(projectRoot, "public"),
  base: "./",
  plugins: [react()],
  build: {
    outDir: path.join(projectRoot, "github-pages"),
    emptyOutDir: true,
  },
});
