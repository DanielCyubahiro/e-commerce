# 0016. Rotation with strict reuse detection

## Status

Accepted.

## Context

Every refresh consumes the presented token and issues a successor sharing the
same session. Detecting reuse, a second presentation of a token already
consumed, is the mechanism that turns a stolen refresh token into a signal
rather than free, silent access.
[`RefreshTokenRepository.rotate`](../../src/identity/application/ports/refresh-token.repository.ts)
reports a closed `RotationOutcome`, and `RefreshSessionHandler` is the only
place that outcome is consumed.

## Decision

A `replayed` outcome, the presented token was already used, causes the
handler to revoke the entire session, every token sharing that `sessionId`,
via
[`RefreshTokenRepository.revokeSession`](../../src/identity/application/ports/refresh-token.repository.ts),
and then answer with the same `AUTH_REFRESH_TOKEN_INVALID` as every other
failure. Killing the whole chain rather than only the replayed token is what
stops the attacker's freshly-issued successor from continuing to work; naming
the same code for every failure is what stops an attacker's forgery attempts
from learning which check tripped.

There is no grace window, no tolerance for one extra presentation of a
just-rotated token to absorb a client retry or race. Two properties of this
design make a grace window unsafe rather than merely unnecessary. First,
tokens are hashed at rest as a
[`TokenHash`](../../src/identity/domain/value-objects/token-hash.vo.ts); the
plaintext a `rotate` call issued is never stored, so there is no way to
re-derive and re-issue that exact successor a second time. A grace window
therefore cannot mean "return the same successor again"; it can only mean
"mint a second, different successor from the same presented token." Second,
that second successor is indistinguishable, from the server's side, from the
successor an attacker would mint after stealing the first: both are a valid
token descending from one that was already consumed once. Any leniency that
tolerates the first case necessarily tolerates the second, forking the chain
into two live successors with no way to tell which one is legitimate. The
mitigation for the client-side race a grace window would otherwise paper
over is a single-flight lock in the client: at most one refresh call for a
given token in flight at a time, which is a client concurrency problem, not
a server leniency problem.

## Alternatives considered

- **No rotation**, a long-lived refresh token reused as-is on every refresh.
  Rejected: a stolen token then works for its entire TTL with no signal that
  theft occurred, since there is no "already used" state to trip.
- **Rotation without reuse detection**, issuing a new token each refresh
  without checking whether the presented one was already spent. Rejected:
  each token still only works once, but nothing distinguishes an attacker
  and the legitimate user racing to refresh from the same stolen token;
  whichever refreshes first silently wins a valid successor while the other
  is locked out with no signal anything happened, rather than the whole
  chain dying and both parties being forced to re-authenticate.

## Consequences

- A legitimate client that double-sends a refresh, a retry racing its own
  original request, revokes its own session exactly as an attacker's replay
  would. This is the cost strict detection accepts; a single-flight lock in
  the client is what avoids paying it.
- `RotationOutcome`'s `replayed` member exists specifically to carry the
  `sessionId` to revoke. The exhaustive `switch` in `RefreshSessionHandler`
  forces every member to be handled, but does not by itself force the
  `revokeSession` side effect; a future edit that handles `replayed` without
  calling it would compile and silently disable reuse detection.
- Every refresh is one transaction and at most two statements: the guarded
  consume (see [ADR 0013](0013-guarded-writes-never-rehydration.md)) and
  either a successor insert or a classification select. There is no separate
  "check for reuse" step to skip or forget.
