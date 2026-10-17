# Development and releases

Current owner instruction, 17 October 2026:

- Publish the latest reference rebuild and continue landing-page iterations through GitHub so the owner can review them on Vercel.
- Keep `development` as the existing Vercel production branch. Automatic Git deployment is enabled.
- Supply code files or replacement instructions when the owner asks for them, or after landing-page approval when requested.
- The owner can also pull `development` into VS Code for local review.
- Do not send or update the retired ChatGPT landing review site.

## Local setup after this release

Get source from GitHub, not Vercel. The repo's `main` branch does not contain the current application; use `development`:

```bash
git clone --branch development --single-branch https://github.com/donatofaith/vimbre.git
cd vimbre
npm ci
npm run dev
```

Use Node.js 24. Open the Local URL printed by Vite, usually http://localhost:5173. Saving React or CSS files updates the browser. These local saves do not publish anything.

When explicitly ready to publish from the local project:

```bash
npm run check
git status
git add src index.html
git commit -m "Update Vimbre landing page"
git push origin development
```

Inspect `git status` and stage the actual intended files, including any configuration or documentation changes when appropriate. Do not stage environment files or secrets. If there are remote changes, preserve local edits and pull/resolve them before pushing; do not force push.

## Pricing source

The original `Vimbre.pdf`, Product Notes for No Code Build dated 13 October 2026, page 7 lists starting company bundles: Starter £29/month up to 10 people; Growth £99/month up to 50; Business £249/month up to 250; Enterprise custom pricing for 250 people and above. Page 8 says the per employee component and exact feature prices may evolve. The newer PRD dated 15 October leaves pricing/limits open rather than restating that table.

On 17 October the owner explicitly authorized use of any tentative names and amounts from the project PRD material. This release uses the original four starting bundles. It does not introduce checkout, plan entitlements, seat-limit enforcement or subscription billing. Business mailbox integrations and Enterprise SSO/custom integrations are not advertised as working capabilities.

The landing describes the intended launch product. Backend capture, AI and handover functionality still need implementation and acceptance. Publishing this design at the owner's explicit request does not change their implementation status.

## Loading intro

The HTML displays the original two-circle Vimbre mark and name immediately while the frontend loads. The routed page signals readiness; the intro then fades out after fonts settle, with a brief minimum display time and a hard fallback. Reduced motion is respected. The intro runs on full page loads, not each internal navigation.
