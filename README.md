# Owlbear Rodeo Extension Starter

A minimal TypeScript and Vite project for building an Owlbear Rodeo extension
with the official `@owlbear-rodeo/sdk`.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Develop locally

```sh
npm install
npm run dev
```

In your Owlbear Rodeo profile, add an extension using this install URL:

```text
http://localhost:5173/manifest.json
```

Then enable the extension in a room and open its action. The starter shows the
SDK connection status and enables a test notification when embedded in
Owlbear Rodeo.

## Build and preview

```sh
npm run build
npm run preview
```

The static site and extension manifest are written to `dist/`. Host that
directory at the root of a site, or adjust the manifest URLs and Vite base path
for your hosting setup before deploying.

## Deploy to GitHub Pages

The `Deploy to GitHub Pages` workflow builds `dist/` and publishes it whenever
changes are pushed to `main`. In the repository settings, set Pages' build and
deployment source to **GitHub Actions**. The Owlbear Rodeo install URL is:

```text
https://iamboredomincarnate.github.io/PERSONAUI_SDK/manifest.json
```

## Project layout

- `public/manifest.json` — Owlbear Rodeo extension manifest
- `public/icon.svg` — icon used by the extension action
- `src/assets/tileset.ts` — named tile coordinates and CSS background styles
- `src/main.ts` — SDK initialization and starter action
- `src/tokenTileMenu.ts` — client-side tile menu for selected character and
  prop tokens
- `src/style.css` — starter UI styles
- `vite.config.ts` — local development server configuration
