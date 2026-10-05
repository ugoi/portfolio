import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
export default defineConfig({
  site: "https://stefandukic.com",
  output: "static",
  adapter: vercel(),
  devToolbar: { enabled: false },
  vite: { build: { target: "esnext" } },
});
