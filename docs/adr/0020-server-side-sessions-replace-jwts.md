# 0020. Server-side sessions replace JWTs for instant revocation

## Status

Accepted. Supersedes [0016](0016-refresh-rotation-with-reuse-detection.md).
Narrows [0015](0015-authentication-without-authorization.md).

## Context

Authentication shipped as an HS256 access token, verified by signature and
expiry alone, renewed through a rotating refresh chain stored in Postgres.
[`docs/contexts/identity.md`](../contexts/identity.md) recorded the
consequence plainly: no revocation path reached a live access token, so a
logout, a password reset, or a deleted user kept working for whatever part
of `ACCESS_TOKEN_TTL_SECONDS` remained. For a shop, where a stolen device or
a shared computer is the ordinary case, that window is the wrong default.

Closing it means a per-request lookup. Once every request does one, a
signature verifies nothing the lookup does not, and a short-lived access
token renewed by a long-lived refresh token is two credentials doing one
credential's job.

## Decision

One opaque session token, held in an `HttpOnly` cookie (see
[0021](0021-cookie-transport-with-lax-and-origin-check.md)), identifies one
row in `sessions`. The token is a
[`SecretToken`](../../src/identity/domain/value-objects/secret-token.vo.ts);
only its digest is stored, as for one-time tokens.

Every protected request runs one statement,
[`DrizzleSessionRepository.touch`](../../src/identity/infrastructure/adapters/drizzle-session.repository.ts):
an `UPDATE sessions SET last_seen_at = now FROM users WHERE token_hash = ?
AND revoked_at IS NULL AND last_seen_at > now - idle AND created_at > now -
absolute RETURNING id, user_id, role`. The lookup is the touch. No row means
401; a row means the session is live and its idle window just moved. The
guard reaches it through
[`AuthenticateSessionCommand`](../../src/identity/application/use-cases/commands/authenticate-session/authenticate-session.command.ts),
because hashing the presented token is a domain operation presentation may
not perform.

Three properties follow from making that one statement the whole mechanism:

- **Expiry is computed, not stored.** There is no `expires_at`; liveness is
  the two anchors against the configured `SESSION_IDLE_TTL_DAYS` and
  `SESSION_ABSOLUTE_TTL_DAYS` at query time. Shortening a TTL after an
  incident applies to every existing session at its next request.
- **The touch is unthrottled.** A throttled bump has to *not* write when the
  row was bumped recently, and the only way an `UPDATE` avoids writing is for
  its `WHERE` to exclude the row, which makes a live, recently bumped session
  indistinguishable from a revoked one without a second `SELECT`: the
  read-then-write shape [0013](0013-guarded-writes-never-rehydration.md)
  forbids. Unthrottled also keeps `last_seen_at` exact, which the device list
  shows. Traffic is low enough that a write per request costs nothing.
- **`role` is live.** It is joined from `users` on every request rather than
  cached in a claim at issue time.

Revocation is `revoked_at` set by one guarded `UPDATE`: `POST /auth/logout`
and `DELETE /auth/sessions/:id` for one session, `POST /auth/logout-all`,
change-password (sparing the caller's own) and reset-password for every
session of a user, and the `sessions.user_id ON DELETE CASCADE` for a deleted
user. Each takes effect on the next request.

## Alternatives considered

- **Opaque access token plus a rotating refresh token, both looked up.**
  Keeps 0016's reuse detection. Rejected: every request pays the lookup
  anyway, so the short-lived access token buys nothing; two cookies and a
  refresh endpoint remain; and sliding expiry conflicts with a token you
  rotate. Theft is handled by revocation from the device list instead of by
  a replay signal.
- **Keep the JWT and add a per-request `sid` status lookup.** The smallest
  diff on paper. Rejected: every request pays for both a signature check and
  a lookup, the `role` claim stays stale, `JWT_SECRET` and its rotation story
  stay, and a reader has to understand two credential mechanisms to reason
  about one revocation.
- **Redis or Mongo for the session store.** Rejected for the reasons
  [0017](0017-token-state-in-postgres.md) already gives, sharpened: user
  deletion would no longer cascade, so `DeleteUserHandler` would have to
  revoke sessions explicitly before deleting the row, and a crash between the
  two leaves live orphans.
- **A throttled touch.** Rejected above; it is two statements or a stale
  `last_seen_at`.

## Consequences

- Every authenticated request writes. The guard must hit the primary; a read
  replica can never front it.
- [0016](0016-refresh-rotation-with-reuse-detection.md) is superseded: with
  the credential `HttpOnly`, idle-expiring, and revocable from a list the
  user can see, replay detection was protecting against a theft this design
  handles by revocation. The `refresh_tokens` table, `RefreshTokenId`, and
  `jose` are gone.
- `GET /auth/sessions` and `DELETE /auth/sessions/:id` are the first
  owner-scoped endpoints, which narrows
  [0015](0015-authentication-without-authorization.md). The rule is the
  repository predicate `user_id = caller`, not a comparison in a handler, so
  another user's session id answers the same 404 as a made-up one.
- Expired rows accumulate until a cleanup job exists, the same stance
  [0017](0017-token-state-in-postgres.md) takes for token tables.
- Two TTLs replace three: `SESSION_IDLE_TTL_DAYS` and
  `SESSION_ABSOLUTE_TTL_DAYS` for `ACCESS_TOKEN_TTL_SECONDS`,
  `REFRESH_TOKEN_TTL_DAYS`, and `JWT_SECRET`. Boot rejects an absolute TTL
  shorter than the idle one.
