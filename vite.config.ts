import { defineConfig } from "vite";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig({
  plugins: [
    legacy({
      modernPolyfills: true
    })
  ],
  server: {
    host: "0.0.0.0",
    port: 5173
  }
});
