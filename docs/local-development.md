# View and edit Vimbre in VS Code

## First setup

Install Node.js 24 and Git. Then open VS Code, choose Terminal > New Terminal and run:

```bash
git clone --branch development --single-branch https://github.com/donatofaith/vimbre.git
cd vimbre
npm ci
npm run dev
```

If GitHub asks you to sign in, use the account with access to the private repository. Open the Local URL printed by Vite, usually http://localhost:5173. This runs the actual application on your computer. You do not need the Live Server VS Code extension. Keep the terminal running; Ctrl+C stops the server.

Use File > Open Folder to open the cloned `vimbre` folder in VS Code. Saving a React or CSS file refreshes the browser automatically. Phone layouts can be viewed using the browser's responsive device tools.

## If you already cloned the repository

Run `git status` first. Keep any local work before changing branches. With a clean checkout:

```bash
git fetch origin
git switch development
git pull --ff-only origin development
npm ci
npm run dev
```

Git normally creates the local branch from its matching remote branch. If it cannot find that branch, run `git switch --track origin/development` instead. Do not use reset or force options to discard edits.

## When new changes are ready

After the code is saved to GitHub, stop the local server with Ctrl+C and run:

```bash
git pull --ff-only origin development
npm run dev
```

Run `npm ci` again only if package.json or package-lock.json changed. If Git reports local changes or a conflict, keep your edits and resolve the conflict before pulling more changes. Do not overwrite your own work to make a pull succeed.

You can also receive focused code edits, make them in VS Code and save to see the result immediately. Keep local edits committed on the draft branch before combining changes from GitHub.

## Landing page files

- `src/features/public/HomePage.tsx`: sections, text, feature descriptions and page structure.
- `src/features/public/HomePage.tsx`: also owns the landing navigation, account links and theme switch.
- `src/features/public/landing.css`: landing page layouts and visual styles.
- `src/styles/tokens.css`: PRD brand colours, fonts, sizes and motion settings.

The application has no review banner and uses local routes for signup, login and workspace links. The local site still connects to the configured development Supabase project; local frontend work does not create an isolated database. See `.env.example` and docs/auth-setup.md when configuring a different backend or testing email callbacks on localhost. The landing page can be reviewed without signing in.

## Before publishing

Run `npm run check`. Browser regression checks use `npx playwright install chromium` followed by `npm run test:browser` in a supported local environment. They intercept backend calls with fixtures.

Saving local files and running Vite do not publish anything. Pushing `development` triggers Vercel automatically. The current owner instruction is to publish landing iterations through GitHub for Vercel review. Supply code directly when requested.
