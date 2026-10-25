import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [preact(), cloudflare()],
  // The native file watcher misses some edits on Windows; polling is reliable.
  server: { watch: { usePolling: true, interval: 300 } },
});
