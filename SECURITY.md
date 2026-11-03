# MasrPrices Security Notes

## Implemented in the application
- Security response headers are added by the Worker, including CSP, HSTS on HTTPS, frame protection, MIME sniffing protection, and a restrictive permissions policy.
- Admin endpoints accept only GET/POST, require the configured ADMIN_PASSWORD, compare password digests without an early-exit byte comparison, and restrict write requests to same-origin JSON with a 256 KiB body limit.
- Public suggestion and real-estate submission endpoints require same-origin JSON and enforce small request-body limits.
- SQL statements use parameter binding; user-provided text is rendered as text in the browser rather than HTML.

## Required operator actions
1. Set ADMIN_PASSWORD as a Worker secret, not in source files, and use a unique randomly generated password of at least 32 characters. Never put it in a public repository or send it in chat.
2. Enable GitHub two-factor authentication and keep repository write access limited to the owner and trusted collaborators.
3. Enable Dependabot security updates and review CodeQL alerts promptly.
4. Configure edge rate limits for POST /api/admin, POST /api/real-estate-admin, POST /api/suggestion, and POST /api/real-estate. The application currently has a per-IP hourly limit for real-estate submissions, but admin login and Telegram suggestions still need edge-level rate limiting.
5. Keep database backups and test restoration. Do not expose database credentials or bot tokens in browser JavaScript.

## Important limitation
Security headers and input validation reduce common risks but do not guarantee that a site cannot be compromised. Rate limiting, secret rotation, backups, account security, and monitoring remain operational requirements.
