# Scaffold review

1. Run npm ci, then npm run check. Type checks, lint, tests and production build must pass.
2. Run npm run dev and open the displayed URL. The homepage uses the fixed PRD positioning.
3. Open the workspace and follow every navigation link. Each unfinished feature clearly says Coming soon.
4. Open an unknown URL. A useful not found page must appear.
5. Set the viewport to 360 pixels. Open and close the mobile menu. Confirm the page has no horizontal scrolling.
6. Use Tab to navigate and activate links and buttons. Focus is visible. The skip link moves to main content.
7. Leave Supabase environment values empty. The app must still render without a network request or fake login.
8. Do not enter a service role, AI or email key in any frontend variable. The environment unit tests check rejection, but cannot undo a secret already shipped in a bundle.

These are scaffold checks only. Business workflow and database authorisation tests will be added with their features.

## Verified for the scaffold

- Local lint, TypeScript and production build passed.
- Four public configuration tests passed, including privileged key rejection.
- Headless browser checks passed for the homepage, five workspace links, unknown workspace URL, mobile menu and 360 pixel width without horizontal overflow.
- Browser checks reported no page errors or external network requests with empty environment configuration.
