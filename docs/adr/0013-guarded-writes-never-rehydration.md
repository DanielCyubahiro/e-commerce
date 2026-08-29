# 0013. Guarded writes, never rehydration

## Status

Accepted for state that is not an aggregate: credentials, tokens, and stock
counters. [0027](0027-lifecycle-aggregates-are-reconstituted-under-optimistic-concurrency.md)
records that an aggregate with a lifecycle is reconstituted and saved under a
version guard, which is this record's mechanism applied to a version column.

## Context

Authentication introduces three kinds of state that need to change under
concurrent access: a credential's password hash and verification timestamp
([`CredentialRepository`](../../src/identity/application/ports/credential.repository.ts)),
a refresh token's rotation
(`RefreshTokenRepository`, since replaced by `SessionRepository`, see
[ADR 0020](0020-server-side-sessions-replace-jwts.md)),
and a one-time token's consumption
([`OneTimeTokenRepository`](../../src/identity/application/ports/one-time-token.repository.ts)).
None of these rows carries a cross-field invariant a construction path would
need to validate; each is a projection with a state machine on one or two
timestamp columns, not an aggregate. Reuse detection on refresh tokens is the
sharpest case: two concurrent callers presenting the same token must not both
be told they rotated it successfully, because that is exactly the state a
stolen token produces.

A load-modify-save shape, an application-level read of the row followed by a
check and a separate write, cannot give that guarantee. Two concurrent callers
can both read `used_at IS NULL`, both decide to proceed, and both write,
because nothing stops the second read from happening before the first write
commits.

## Decision

Every state transition on these three tables is one guarded SQL statement: an
`UPDATE ... WHERE <precondition> RETURNING ...`, never a `SELECT` followed by
an application-level check and a second statement.
[`DrizzleCredentialRepository.markEmailVerified`](../../src/identity/infrastructure/adapters/drizzle-credential.repository.ts)
guards on `email_verified_at IS NULL`;
[`DrizzleOneTimeTokenRepository.consume`](../../src/identity/infrastructure/adapters/drizzle-one-time-token.repository.ts)
guards on `used_at IS NULL AND expires_at > now`;
`DrizzleRefreshTokenRepository.rotate` (removed with [ADR 0020](0020-server-side-sessions-replace-jwts.md))
guards on `used_at IS NULL AND revoked_at IS NULL AND expires_at > now`. Each
adapter runs a second, unguarded `SELECT` only on the losing path, purely to
classify why the guard matched nothing (`expired`, `used`, `revoked`,
`unknown`); that classification can be marginally stale without harm, because
nothing about correctness depends on it, only the message a caller sees.

The mechanism this relies on, and the reason no `SELECT ... FOR UPDATE` is
needed first: Postgres's default `READ COMMITTED` isolation makes an `UPDATE`
itself the lock. The first caller's `UPDATE` takes a row lock and, once it
commits, has changed the row the guard tests. A second, concurrent `UPDATE`
against the same row blocks on that lock rather than proceeding; once the
first transaction commits and the lock releases, Postgres re-evaluates the
second statement's own `WHERE` clause against the now-committed row, not the
row as it looked when the second statement started. `used_at IS NULL` is now
false, so the second statement matches zero rows and its `RETURNING` clause
comes back empty. Exactly one of two concurrent callers can ever see a row
come back from a rotation or a consumption; the other sees none, deterministically,
with no additional locking clause required.

Every outcome these guarded statements can produce is a closed union
(`RotationOutcome`, `ConsumeOutcome`), and every handler that consumes one
dispatches through an exhaustive `switch` ending in a
`/* istanbul ignore next -- unreachable by construction */` default case that
assigns the narrowed value to a `never` and throws. That default branch is
provably unreachable today: the preceding cases already cover every member of
the union, so nothing on the current outcome types can reach it. It stays
unreachable only because `pnpm build` type-checks production code (`pnpm
test` does not; ts-jest is transpile-only here) and a member added to
`RotationOutcome` or `ConsumeOutcome` without a matching `case` fails that
`never` assignment at compile time. The `istanbul ignore` comment tells the
coverage tool the same fact the type checker already enforces, so the branch
does not have to be exercised to satisfy the domain and application coverage
thresholds, without lowering those thresholds or asserting the branch is safe
for any reason other than the compiler catching its precondition.

## Alternatives considered

- **A persistence factory on a `Credential` aggregate**, loading a `Credential`
  through a non-validating construction path, calling a mutation method, and
  saving it back. Rejected: it reintroduces exactly the load-modify-save race
  this record exists to close, since the load and the save are still two
  separate statements with a window between them, and there is no invariant
  on this data an aggregate would be protecting that a guarded statement does
  not already enforce more cheaply.
- **A general unit of work** wrapping multiple repository calls in one
  transaction with an application-level version check or lock. Rejected:
  Postgres's row lock already provides the atomicity a unit of work would
  otherwise have to simulate; layering one on top would either still bottom
  out in a guarded statement, making it redundant, or reimplement locking at
  the application layer, which is strictly more code for the same guarantee.

## Consequences

- `Credential`, a refresh token, and a one-time token have no domain
  aggregate and no persistence factory; the three repository interfaces are
  the whole model for this state.
- A new write against any of these three tables that reads the row first and
  writes second is a regression of this record, not a stylistic choice; the
  guard belongs in the `WHERE` clause of the write itself.
- The three `istanbul ignore next` guards depend on `pnpm build` running; a
  reviewer who sees one added without also running that command has not
  verified the exhaustiveness it claims.
- Since [ADR 0020](0020-server-side-sessions-replace-jwts.md),
  [`DrizzleSessionRepository.touch`](../../src/identity/infrastructure/adapters/drizzle-session.repository.ts)
  is the live instance of this rule: the per-request session lookup and its
  idle-window extension are one guarded `UPDATE`, so a session revoked
  between two requests cannot be extended by the second.
