# 0021. Cookie transport with `SameSite=Lax` and Origin verification

## Status

Accepted.

## Context

[0020](0020-server-side-sessions-replace-jwts.md) puts the whole credential
in one opaque token. The frontend on `WEB_BASE_URL` is a browser, so the
token must travel in a way page scripts cannot read, which rules out a
`Bearer` header the SPA would have to hold in JavaScript. A cookie brings
CSRF with it: the browser attaches it to any request to the API's site,
including one a hostile page initiated. This is an e-commerce API, so the
stance has to survive checkout flows that return from a payment provider by
top-level navigation, and a frontend that may one day render on the server.

## Decision

The session travels in a cookie named `session` with `HttpOnly;
SameSite=Lax; Path=/`, host-only (no `Domain`), `Max-Age` equal to
`SESSION_IDLE_TTL_DAYS`, and `Secure` exactly when `WEB_BASE_URL` starts
with `https:`. Every attribute lives in one class,
[`SessionCookie`](../../src/identity/presentation/session-cookie.ts), which
also guarantees at most one `Set-Cookie` for the session per response, so
the guard's slide followed by logout's clear leaves the clear.

On top of `Lax`,
[`SessionAuthGuard`](../../src/identity/presentation/guards/session-auth.guard.ts)
rejects with 403 `AUTH_ORIGIN_FORBIDDEN` any request whose `Origin` header
is present and is not `WEB_BASE_URL`'s origin, before the `@Public()`
short-circuit. Absent `Origin` passes: only a browser can be CSRF'd, and
browsers send `Origin` on every cross-origin `POST`, `PUT` and `DELETE`. The
literal `null` is present and differs, so it is rejected. Running the check
on public endpoints too closes login CSRF, where a cross-site form post to
`/auth/login` would plant the attacker's session in the victim's browser.

CORS is enabled in `configureApp` with an origin predicate that admits
exactly `WEB_BASE_URL`'s origin with `credentials: true`, and answers no
`Access-Control-Allow-Origin` at all to any other origin. A fixed string or a
wildcard is never used, so the header is never reflected from an arbitrary
request: the `cors` package emits a fixed string unconditionally, which is
why the code uses a predicate instead. `WEB_BASE_URL` therefore carries three
duties: mail links, the CORS and Origin-check origin, and the cookie's
`Secure` flag. Deriving `Secure` from the scheme rather than from its own
variable removes a knob to misconfigure, and avoids class-transformer's
implicit conversion turning the string `"false"` into `true`.

## Alternatives considered

- **`SameSite=Strict`.** Defensible for this exact repo today, because the
  API is never the navigation target: the SPA's `fetch` after returning
  from a payment redirect is a same-site request from the landed page. It
  breaks the moment the frontend server-side renders and forwards the cookie
  during the first render of an externally initiated navigation, which is
  the checkout-return case. Every major framework defaults to `Lax` for the
  same reason.
- **A double-submit CSRF token.** A second cookie or endpoint, a header the
  frontend must echo, and a comparison in the guard, for a threat the Origin
  check already covers statelessly. OWASP names Origin verification as the
  recommended primary defence for APIs.
- **`Bearer` header, as before.** No CSRF surface and no CORS credentials,
  but the SPA holds the credential in JavaScript, readable by any injected
  script.
- **A `SESSION_COOKIE_SECURE` variable.** Rejected above.
- **The `__Host-` cookie prefix.** Browsers would enforce `Secure`, no
  `Domain`, and `Path=/` for us, but it requires `Secure`, which local
  `http://localhost` development does not have. Worth revisiting once the
  API is https-only everywhere.

## Consequences

- The frontend must be same-site with the API: `localhost:5173` and
  `localhost:3000` already are; in production that means sibling
  subdomains of one registrable domain, never a separate domain.
- Non-browser clients (Postman, curl) send no `Origin` and carry no ambient
  cookie, so they are unaffected by the check and must present the cookie
  explicitly, which Postman's cookie jar does after a login request.
- `sessions.ip_address` records `request.ip`, which behind a proxy is the
  proxy until Express's `trust proxy` is configured; that is a deployment
  setting, not part of this record.
- A request with a forged `Origin` from a non-browser client is rejected
  too, harmlessly: it never carried a credential to protect.
