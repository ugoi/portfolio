# Contact form operation

The portfolio is static Astro HTML with a small TypeScript controller and the
original Three.js world. HTMX enhances the native HTML form. Only `/api/contact`
runs on the server. The previous React app is no longer shipped to the browser.

## Required configuration

The route deliberately returns **503, not success**, until all server-only values
from `.env.example` are configured. None use the `PUBLIC_` prefix.

- `RESEND_API_KEY`: sending permission for the verified sender domain.
- `CONTACT_FROM`: a fixed address on that domain. Visitor address is Reply-To;
  recipient is fixed in code to `codecraftingpro@gmail.com`.
- `CONTACT_SECRET`: a random value of at least 32 characters, shared between all
  instances in one environment. Generate with `openssl rand -hex 32`.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`: Redis REST service with
  GET/SET/DEL/INCR/EXPIRE/EVAL permissions. This is short-lived abuse-control state,
  not a contact/message database. Do not expose a private homelab Redis publicly.

Use Vercel preview-scoped environment variables during review. Production and
preview keys are namespaced separately using `VERCEL_ENV`. Do not add a paid plan
without Stefan's decision. Verify the sender subdomain using provider-supplied
DNS records; do not replace the website's DNS routes or existing MX records.

Preview configuration was completed on 2026-10-05 using the existing authenticated
Resend account and verified sender domain. A separate sending-only key is scoped
to that domain. The dedicated Upstash database uses the Free plan; all five Vercel
values were initially Secrets restricted to Preview. They were subsequently
configured separately for Production before the authorized release. Recovery
values are in Vaultwarden.
The optional Paperclip Resend MCP connection is not required for runtime sending.

A controlled submission reached the intended Gmail inbox, with matching content,
Reply-To and passing SPF/DKIM/DMARC. The live cross-transport retry test exposed
a newline mismatch: native forms encode CRLF while HTMX sends LF. The handler now
normalizes message line endings before validation, hashing and provider delivery;
a regression test covers both CRLF and CR retries. Keep provider acceptance,
actual inbox receipt and repeat suppression as separate release checks.

## Abuse protection and retries

Body limit: 65,536 bytes (streamed limit, even without Content-Length). Name up to
100 characters, email up to 254, message 10–5000. Reject duplicate fields, header
control characters, unsupported encodings and cross-origin browser posts. Escape
all reflected form values. The honeypot never calls the provider.

A single atomic Redis script applies 3 submissions per IP per hour, 3 per email
per hour and 30 across the site per hour. It reserves a message for 60 seconds to
prevent concurrent sends. Counters expire in one hour; successful-message HMACs
expire in 24 hours. Redis stores only keyed hashes and counts, never addresses,
IP strings or content. Availability failures stop sending rather than bypassing
limits. IP comes from the hosting adapter, not a parsed visitor header.

The same name/email/message, with normalized message line endings, uses a stable
Resend idempotency key. Retrying
an uncertain provider result cannot duplicate a send within the provider's
24-hour window. A provider acceptance is reported as *accepted for sending*, not
proof of inbox arrival. There is no automatic visitor confirmation email.

## Verification / release

```sh
npm ci
npm run lint
npm test
npm run build
# First install the test browser, or set CHROMIUM_EXECUTABLE to a test browser.
npx playwright install chromium
npm run test:browser
```

Browser tests use built static output and the built Vercel function for the
unconfigured/error paths. The success test calls the shared request handler. Their
positive-send case deliberately injects a simulated sender; the production
route has no mock-mode flag. Negative cases exercise real fail-closed behavior.

Before production: configure preview secrets, validate Redis limits across
separate requests/instances, send one unique controlled message, verify provider
acceptance **and the actual intended inbox**, then review the preview. Verify
native POST without JavaScript, keyboard focus and inline errors on that preview.
A successful local build or mock test does not finish mail setup.

Stefan explicitly authorized production publication on 2026-10-05 (STE-37).
Configure the same five server secrets for Production before merging the release;
the existing dedicated Redis database separates production and preview state.
Verify the deployed source and a controlled submission on the public domain,
including actual inbox receipt, after deployment.
Previous application baseline: `5304943ea33b0afa7407b61118f12793fba1adad`.
Existing production deployment (verified from GitHub's Vercel status):
https://vercel.com/ugois-projects/portfolio/J4cijAoQPSdQcLFLTUGsexMbYdka
Rollback by promoting that known deployment (reconfirm before release).

## Presentation update (2026-10-05)

Stefan requested a plain name wordmark, aligned contact button and removal of the
blueprint selector. The ocean now uses a single adaptive surface from the buoy to
the horizon, replacing the separate lowered background plane. The capability-gated
scene import starts immediately. Small desktop/mobile WebP frames from that exact
scene bridge network/shader startup and crossfade into the rendered scene; they
also provide the no-WebGL/no-JavaScript view. Reduced motion and context-loss
recovery remain supported. These frames are not a claim of instantaneous network
loading or a GPU/frame-rate benchmark.

## Contact dialog and recipient check (2026-10-05)

The navigation and bottom contact heading open a native modal dialog directly,
without changing the underlying scroll/depth. Escape, the close button or a full
backdrop click close it; focus returns to the trigger. Drafts survive closing.
The dialog confines focus, locks page scrolling and scrolls only its own contents
for a response. Reduced motion is respected. Without JavaScript, the same links
open `/kontakt`, which serves the same native POST form. The response page retains
inputs on failure. No component library or third-party form host is involved.

Production secrets are configured separately for Production and Preview. The
fixed notification mailbox is **codecraftingpro@gmail.com**, not the other
configured Gmail account stefandukic209@gmail.com. A visitor's email is Reply-To,
not the delivery recipient, and no visitor acknowledgement is sent. Stefan's
reported missing test was independently found in the intended inbox at
2026-10-05 11:23:24 UTC (IMAP UID 381), with passing SPF/DKIM/DMARC. This distinction
must be made explicit when diagnosing notifications; provider acceptance alone
is not proof of arrival.

Current rollback baseline before the dialog release: `b9a73b65feb7aae5fea7f2a94fda3e8217ebdcfe`,
Vercel deployment `HReTxEzxwn8MWMvCSDuNvnj54NCX`.
