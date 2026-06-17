# Rayen Family Tree

A read-only family tree website built with Vite, React, and TypeScript. The tree data lives in [src/family-tree.json](src/family-tree.json), and the edit action is a Discord request link rather than an in-app editor.

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open the local URL shown in the terminal, usually:

```bash
http://localhost:5173
```

## Build For Production

Create the production bundle with:

```bash
npm run build
```

The compiled site is written to the `dist` folder.

## Deploy On Cloudflare Pages From GitHub

This repository is set up for Cloudflare Pages as a static Vite site.

1. Push this repository to GitHub.
2. In Cloudflare, go to **Workers & Pages** and create a new **Pages** project.
3. Choose **Connect to Git** and select the GitHub repository.
4. Use these build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler versions upload`
   - **Path:** `/`
5. Make sure `wrangler.jsonc` is present at the repo root so Wrangler uploads the `dist` folder as static assets.
6. Deploy the project.

## Notes

- The site is read only by design.
- To change the family tree content, edit [src/family-tree.json](src/family-tree.json) and redeploy.
- If you change the Discord edit contact, update the `editContact.href` field in the settings file.
