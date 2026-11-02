# Credential audit — 2 November 2026

No private API key, provider credential, privileged Supabase token, private signing key, or real environment file was identified in the audited source or retrievable Git history. No existing provider secret needed moving: sensitive integrations already execute in server functions. This audit adds safeguards against future configuration mistakes; it does not claim that a confirmed production leak occurred.

## Scope and history coverage

| Repository | Audited current source | Reachable commits | References checked |
| --- | --- | ---: | --- |
| donatofaith/vimbre | development at fba467a00297054348e296b660e40271ac7b8e3a; main and other branches through history | 613 | 99 branches and 56 pull request refs |
| donatofaith/vimbre-console | main at a008aec607066a4e99f451b74fc23a567f07c5f6 | 95 | 13 branches and 8 pull request refs |

All listed ref tips and commit parents are covered. No tag refs were advertised. Vimbre history contains 4,248 file changes: 4,214 patches plus 76 full text blobs used to supplement large or omitted patches. Console history contains 481 complete patches. Patch addition/deletion counts were checked against API metadata; no uncovered partial text patches remain. History dates begin on 13 October for Vimbre. These counts precede the audit commits themselves.

Scans checked provider key formats, privileged JWT roles, private key headers, credential-bearing URLs, literal secret assignments, and credential filenames. Matches were reviewed in context: they were synthetic browser/worker credentials, deliberately invalid URL/key tests, and public configuration. Only `.env.example` appears among environment/credential filenames in this history; it contains blank public configuration fields.

Coverage excludes unreachable/deleted history no longer exposed by GitHub, other people's clones/forks, binary image contents, deployment environment values, provider dashboards, and production logs. It cannot establish that a secret was never disclosed outside this repository. Production configuration and already deployed assets were not independently certified by this source audit.

## Findings and fixes

| Finding | Files | Fix |
| --- | --- | --- |
| Browser configuration could be bundled before a runtime check rejected it. Console previously accepted any configured key. No real private key was found there. | Both `vite.config.ts`; new `scripts/public-env.ts` and tests; Console `src/api.ts`, new `src/env.ts` and tests | Validate public configuration before Vite transforms code. Allow only the two public Supabase variables, plus the Console preview/production label. Reject secret/service-role keys, invalid keys, credential-bearing URLs, and all unapproved `VITE_` variables without echoing values. Console also validates before constructing its SDK client. |
| Backend modules had no explicit frontend build import boundary. No existing offending import was found. | Both `vite.config.ts` and `scripts/public-env.ts` | Production builds reject application imports from `supabase/functions`, `api`, `email-worker`, `server`, `scripts`, and `.server` JS/TS modules. |
| Existing ignore rules covered `.env` and `.env.*`, but missed other common credential files. | Both `.gitignore` and `.env.example` | Add `.dev.vars`, `.envrc`, private key formats, credential/service-account JSON patterns, credential directories, registry/network/password files, Terraform state, and local deployment state. Keep the blank public example trackable and explain the server boundary. |
| Console CI used an arbitrary fake key incompatible with the new validator. | Console `.github/workflows/checks.yml` | Replace it with an explicitly synthetic publishable-format fixture. |

Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and, for Console, `VITE_CONSOLE_ENV` are approved browser environment variables. The existing hardcoded Supabase publishable identifier in `src/lib/public-project.ts` is public configuration, not a private credential. Signed-in users' own session tokens remain necessary for authentication; they are not provider master keys.

## Provider request paths checked

| Integration | Server boundary |
| --- | --- |
| Anthropic | `src/lib/ai-gateway.ts` calls Vimbre's `ai-run`; `supabase/functions/ai-run/runtime.ts` and `adapters/anthropic.ts` read/use the server key. |
| Stripe | Customer billing invokes `stripe-billing`; its `index.ts` reads sandbox/live keys and signing secrets from server environment variables. |
| OAuth providers | Capture invokes `capture-connect`; `providers.ts` and `work-tools.ts` perform provider exchanges and API requests on the server. Stored provider access/refresh secrets stay behind private service/Vault operations. |
| Email and push | Vimbre and Console Edge workers read Brevo, inbound and signing credentials on the server. |
| Console | `src/api.ts` uses the public Supabase client and user session. Privileged provider work runs through Console Edge functions; the Console read API uses caller-scoped authorization. |

Direct browser Supabase Auth/data calls use public client configuration and user sessions. A document-link HEAD check and public analytics assets also exist; neither attaches a provider secret. They do not need conversion into secret-bearing proxy requests.

## Verification

- Vimbre: 344 unit tests passed; TypeScript/production build, prerendering and offline asset generation passed.
- Console: 103 unit tests passed; TypeScript/production build passed.
- Lint exited successfully for both; Vimbre retains pre-existing warnings outside this change.
- Six actual negative builds rejected an unknown public credential variable, a privileged Supabase key, and a credential-bearing URL in both apps. Supplied canary values were absent from error output.
- Two actual builds importing backend entry points were rejected by the import boundary; temporary probes were restored.
- Successful bundles contained none of seven synthetic server credential canaries per app. Build manifests contained no application server entry modules. This checks environment isolation, not the validity of any real credential.
- Nineteen credential-path ignore cases passed per repository, including nested environment files; `.env.example` remains trackable.
- No paid API call, real email, key rotation, history rewrite, or production deployment was performed by this audit.

## Rotation and history cleanup

There is no identified compromised credential to rotate or sensitive history path to remove based on these findings. Do not rewrite history merely to remove the public Supabase publishable identifier or fake test values.

If a separate exposure is discovered, first identify the provider, variable, file and introducing commit without sharing the full value. Revoke/rotate the affected credential, update every dependent server environment, redeploy those server functions, verify a small authorized operation, and confirm the old credential no longer works. For a currently abused credential, revoke immediately. Examples of server locations include Supabase Edge Function Secrets and Cloudflare worker secrets; never put replacements in `VITE_` variables.

Then coordinate a history cleanup in an isolated fresh clone. Use current `git-filter-repo --sensitive-data-removal` guidance with the exact confirmed paths or a local replacement file for embedded values. Review the rewritten refs before any force push, include all affected branches/tags, and coordinate clean clones with collaborators. GitHub cached pull request views and forks can require separate cleanup. A rewrite alone does not invalidate a key. No cleanup command targeting an unconfirmed file has been run.

References: [Vite environment variables](https://vite.dev/guide/env-and-mode), [Supabase API key security](https://supabase.com/docs/guides/getting-started/api-keys), [GitHub sensitive-data removal](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
