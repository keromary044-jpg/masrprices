# MasrPrices Security Notes

## Implemented in the application
- Security response headers are added by the Worker, including CSP, HSTS on HTTPS, frame protection, MIME sniffing protection, and a restrictive permissions policy.
- Admin endpoints accept only GET/POST, require the configured ADMIN_PASSWORD, compare password digests without an early-exit byte comparison, and restrict write requests to same-origin JSON with a 256 KiB body limit.
- Public suggestion and real-estate submission endpoints require same-origin JSON and enforce small request-body limits.
- Worker-level rate limits are configured for admin endpoints (12 requests/minute/IP), public read endpoints (90/minute/IP), public real-estate submissions (5/minute/IP), and suggestions (5/minute/IP). Cloudflare's Workers Rate Limiting API is approximate and counters are local to each Cloudflare location; it is not a strict global denial-of-service defense.
- SQL statements use parameter binding; user-provided text is rendered as text in the browser rather than HTML.
- The main HTML has no inline script blocks or inline event-handler attributes, so the script policy does not need unsafe-inline for JavaScript.

## Required operator actions
1. Set ADMIN_PASSWORD as a Worker secret, not in source files, and use a unique randomly generated password of at least 32 characters. Never put it in a public repository or send it in chat.
2. Enable GitHub two-factor authentication and keep repository write access limited to the owner and trusted collaborators.
3. Enable Dependabot security updates and review CodeQL alerts promptly.
4. Confirm the Worker is deployed with the rate-limit bindings from wrangler.toml. The bindings require a Wrangler version that supports the Workers Rate Limiting API. If they are absent, protected API routes intentionally return HTTP 503 instead of silently running without the configured limiter.
5. Set ADMIN_PASSWORD as a Worker secret, not in source files, and use a unique random value of at least 32 characters. Never put it in a public repository or send it in chat.
6. Keep database backups and test restoration. Do not expose database credentials or bot tokens in browser JavaScript.
7. Enable GitHub two-factor authentication, restrict repository write access, enable Dependabot security updates, and review CodeQL alerts. Branch protection could not be verified through the available GitHub connection.

## Important limitation
Security headers and input validation reduce common risks but do not guarantee that a site cannot be compromised. Rate limiting, secret rotation, backups, account security, and monitoring remain operational requirements.
