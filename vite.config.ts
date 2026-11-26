import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/PERSONAUI_SDK/",
  server: {
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
    host: "127.0.0.1",
  },
}));