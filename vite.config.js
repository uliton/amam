import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/amam/" : "/",
  server: { port: 5173 },
});
