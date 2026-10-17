# Development, review and releases

Updated 17 October 2026 at the project owner's request.

## Working branch

Work on `draft/landing-polish` and future `draft/*` branches. Never push unfinished work directly to `development`, which powers the current live Vercel website. Vercel's `git.deploymentEnabled` configuration disables Git deployments for `draft/*`. Keep that rule in every draft commit, including the first commit used to create a branch.

GitHub checks run on draft pushes. This is a workflow rule, not a claim that protected branches are configured.

## Local review

The owner now views and edits the real application in VS Code using Vite. Follow [local setup](local-development.md). Do not publish to or send the retired ChatGPT landing review site. Its banner and standalone build scripts are not part of the application.

Build a section, run relevant checks, save the code on the draft branch and let the owner pull and review it locally. Finish the public landing page to the owner's satisfaction before progressing to the employee experience, then manager and HR Admin screens. Saving a file refreshes the local browser without consuming Vercel quota.

## Release gate

Only after the owner explicitly asks to publish: run relevant checks, inspect the final diff, verify the promised launch features and merge the approved draft into `development`. Vercel then builds that milestone. Verify the actual deployment before reporting it as published.

The public landing draft now presents the intended launch product without Available or Coming soon labels, as explicitly requested by the owner. Capture, AI review and handovers must be implemented and accepted before releasing that presentation. Changing the marketing copy does not change the current backend implementation status.

Local application testing uses the configured development database. Use controlled test accounts and follow docs/auth-setup.md for callback origins when testing Auth email flows. Automated browser checks intercept backend calls with fixtures.
