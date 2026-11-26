import { defineConfig } from "vite";

export default defineConfig({
  base: "/PERSONAUI_SDK/",
  server: {
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
    host: "127.0.0.1",
  },
});