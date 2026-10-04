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

The Resend connection card on STE-37 is still pending. No live API key, verified
sender, shared Redis service or actual inbox delivery is claimed by this branch.
A connected management tool is not itself a deployed runtime sending key.

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

The same exact name/email/message uses a stable Resend idempotency key. Retrying
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

Browser tests use built static output and the actual request handler. Their
positive-send case deliberately injects a simulated sender; the production
route has no mock-mode flag. Negative cases exercise real fail-closed behavior.

Before production: configure preview secrets, validate Redis limits across
separate requests/instances, send one unique controlled message, verify provider
acceptance **and the actual intended inbox**, then review the preview. Verify
native POST without JavaScript, keyboard focus and inline errors on that preview.
A successful local build or mock test does not finish mail setup.

Production remains on the current deployment until Stefan reviews the preview.
Previous application baseline: `5304943ea33b0afa7407b61118f12793fba1adad`.
Existing production deployment (verified from GitHub's Vercel status):
https://vercel.com/ugois-projects/portfolio/J4cijAoQPSdQcLFLTUGsexMbYdka
Rollback by promoting that known deployment (reconfirm before release).
