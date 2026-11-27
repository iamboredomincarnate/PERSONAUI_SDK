# Persona UI

## Local Owlbear Rodeo development

1. Run `npm run dev` and leave the Vite server running.
2. In your Owlbear Rodeo profile, add `http://localhost:5173/manifest.dev.json` as an extension.
3. Enable **Persona UI (Local)** in the room.

Vite serves the app from localhost and hot-reloads source changes in the open room. No GitHub push is needed. The regular `public/manifest.json` remains configured for production.

Run `npm run build` to type-check and create the production bundle.

The element panel shows enabled tokens' names, optional levels, and elemental
affinities at all times. In the **Assign Elements** context menu, enable **Use
This Plugin** to show the panel and replace the token's native name label.
Level `0` is omitted; the separate **Show level as ???** option masks any
nonzero level.

Persona UI remembers element assignments, level, visibility, and plugin
enabled state by token identity. Copies of the same image asset share that
saved state, and changes made to one copy are synchronized to the others.
