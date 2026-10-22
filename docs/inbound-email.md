# Forward email into private Capture

## Implemented

capture-inbound receives Brevo inboundEmailProcessed batches. It requires the CAPTURE_INBOUND_TOKEN Edge secret, at least 32 characters, in the Authorization bearer header before it reads a body. Platform JWT verification is disabled only for this external webhook; the handler enforces its own secret. The service credential never leaves the Edge function.

The handler uses actual envelope Recipients, not visible To headers. It accepts only plain text/parsed Markdown, ignores HTML and attachment download tokens, skips spam scores of 5 or greater, and bounds bodies, batches, recipient counts and source bytes. It stores no full webhook in logs. Database failures return 503 for provider retry.

The service-only capture_receive RPC derives company and owner from a verified, enabled forwarding-address row. It requires an active owner and a sender matching that account's email. This sender check is an additional restriction, not independent proof of sender identity: receiving addresses must be random and kept private, and provider account/webhook credentials must stay protected. Unknown address/sender responses do not expose mailbox existence. A per-address row lock makes message-hash deduplication and the 100 messages per UTC day limit race safe. Receipt metadata is private and not customer readable. The original source is visible only to its owner under existing Capture RLS. It creates no task, decision, AI call or confirmed draft. The owner opens Capture, generates drafts and confirms them normally.

## Activation still required

1. In Supabase Edge secrets create CAPTURE_INBOUND_TOKEN with a randomly generated value of at least 32 characters. Never commit or paste the value into frontend code.
2. Verify a separate receiving subdomain in Brevo, for example capture.vimbre.com. Do not replace MX records for hello, support or the main sending domain. For the chosen receiving subdomain, follow Brevo's current inbound guide to add its MX records.
3. Create a Brevo inbound webhook with type inbound, event inboundEmailProcessed, the chosen receiving domain and URL https://ijyjrooarwoafkykvzjp.supabase.co/functions/v1/capture-inbound. Configure bearer auth with the same secret in Brevo. The SMTP key alone does not configure inbound receiving.
4. Provision a random, unguessable address per active user in capture_forwarding_addresses using an operator/service context. Keep enabled false and verified_at null while testing; do not invent a verified status. Verify provider delivery on a dedicated test address and inspect the authenticated receipt result before enabling real addresses. Never publish users' addresses in source control.
5. After a genuine delivery check, set that owner's verified_at timestamp and enabled true. My day and Capture then display the real address. Mail must be forwarded from the account email. Test unknown addresses, wrong senders, provider retry, disabled/inactive owners and the daily cap.

No provider key or DNS connection is available to this build session, so no real mailbox or forwarding address has been enabled. This is a release dependency for the forwarding feature, not a requirement for pasted email, PDF/text drafts or normal tasks.

References: https://developers.brevo.com/docs/inbound-parse-webhooks and https://developers.brevo.com/docs/secured-webhooks.
