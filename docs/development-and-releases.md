# Development, review and releases

Updated 17 October 2026 at the project owner's request.

## Release policy

Work on `draft/landing-polish` and future `draft/*` branches. Never push draft changes directly to `development`: that branch currently powers the live Vercel website. Vercel's `git.deploymentEnabled` configuration disables Git deployments for `draft/*`. Keep this rule in every draft commit, including the first commit when creating a branch. Do not create a branch from an unmodified deployment-enabled commit and push a fix afterward.

GitHub checks run on draft pushes. An explicit request from the project owner is required before releasing to Vercel. Opening a design review does not approve a release.

## Review loop

1. Build the current feature on the draft branch.
2. Run `npm run check`.
3. Run `npm run dev` for interactive local application testing. Open the Local URL printed by Vite on the same computer. Localhost is not a remotely accessible review link.
4. Run the existing browser checks in a supported browser environment for application regression testing.
5. For public website feedback, run `npm run build:landing-review`. This generates `landing-review/index.html` from the actual landing React component and shared CSS. The page contains no account session, customer data or Supabase requests. Fonts are embedded. Navigation, theme switching and FAQ expansion work. Account links deliberately open the current live website.
6. Update the separate owner-private landing review site when requested work is ready for review. It is a design review, not a second production application or a backend test environment.
7. Collect feedback and repeat. Keep the live website unchanged throughout this loop.

The private landing review site is https://vimbre-landing-review.arcanegnome2049.chatgpt.site. It does not consume Vercel deployment quota. Its source is derived from this repository by the landing review build script; this repository remains the application source of truth.

## Publishing a milestone

Only after the owner explicitly asks to publish: rerun relevant checks, inspect the diff and merge the approved draft changes into `development`. Vercel then builds that release. Verify the deployment and live entry points before reporting it as published. Preserve the existing production branch until a separately approved migration.

The configuration permits deployment from `development` and other non-draft branches. The release gate is the explicit approval requirement plus keeping all unfinished work on `draft/*`; it is not a claim that GitHub branch protection is enabled.

For interactive application reviews beyond the landing page, use local development or deliberately provision a separate staging application with its own approved Auth callback URLs and test data. The landing review does not test signup, login, email delivery or workspace permissions.
