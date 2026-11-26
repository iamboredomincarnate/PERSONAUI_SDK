# Persona UI

## Local Owlbear Rodeo development

1. Run `npm run dev` and leave the Vite server running.
2. In your Owlbear Rodeo profile, add `http://localhost:5173/manifest.dev.json` as an extension.
3. Enable **Persona UI (Local)** in the room.

Vite serves the app from localhost and hot-reloads source changes in the open room. No GitHub push is needed. The regular `public/manifest.json` remains configured for production.

Run `npm run build` to type-check and create the production bundle.
