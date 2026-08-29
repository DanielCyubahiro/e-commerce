# 0017. Token state in Postgres

## Status

Accepted. The reservation of Mongo for a future context is closed by
[0024](0024-orders-live-in-postgres.md): orders are relational too.

## Context

This repo has both Postgres, home to `users` and the catalogue, and Mongo,
connected at boot but reserved for a future context (`.env.example`'s comment
on `MONGO_DB_URI`). Authentication needs to persist three new kinds of state:
credentials, one row per user; refresh tokens, an append-mostly chain per
session; and one-time tokens, single-use verification and reset secrets. Each
needs a decision about which database owns it.

## Decision

All three live in Postgres, as ordinary tables with foreign keys to `users`
(`credentials.user_id`, `one_time_tokens.user_id`, `refresh_tokens.user_id`,
each `ON DELETE CASCADE`).
[`UserWriteRepository.register`](../../src/identity/application/ports/user.write-repository.ts)
writes `users`, `credentials`, and the first `one_time_tokens` row in one
transaction, so a token row and the user it verifies never exist apart from
each other. The cascade means `DELETE /users/:id` removes every credential
and token row for that user as part of the same statement, with no separate
cleanup job.

An index on each token table's lookup path
([`one_time_tokens_user_id_purpose_idx`](../../src/shared/infrastructure/database/postgres/schema/one-time-tokens.schema.ts),
`refresh_tokens_session_id_idx` (dropped with [ADR 0020](0020-server-side-sessions-replace-jwts.md)))
is ordinary storage hygiene, the same category as any other query-serving
index, not a substitute for an expiry guarantee: every token row still
carries its own `expires_at`, checked in the guarded `WHERE` clause on every
read (see [ADR 0013](0013-guarded-writes-never-rehydration.md)), because an
indexed lookup path says nothing about whether the row it finds is still
valid.

That distinction is also why Mongo was rejected here specifically. The
natural mechanism for this shape of data in Mongo is a TTL index
(`expireAfterSeconds`), which deletes documents once they age out. Mongo
documents that mechanism as a background reaper running on its own schedule,
best-effort storage hygiene, not a guarantee that an expired document is gone
the instant it expires. Depending on it for correctness rather than for
eventually reclaiming space would still leave a query able to observe an
expired-but-not-yet-reaped token, which the application would have to guard
against with the same `expires_at` check it already needs in Postgres. Once
that check has to exist regardless of the store, a TTL index adds nothing but
a second database to keep available and consistent with the first. Mongo
stays reserved for a future context whose data actually wants a document
shape, variable, nested, or schema-flexible, which none of these three
tables are: each is a fixed set of scalar columns with a foreign key, exactly
what a relational table already models directly.

## Alternatives considered

- **All token state in Mongo.** Rejected: none of the three tables has a
  variable or nested shape a document model would help with, and splitting
  auth state across two databases would mean registration's one-transaction
  guarantee could no longer be one transaction, since Postgres and Mongo
  share no transaction boundary, reopening the partial-account problem that
  guarantee exists to close.
- **Refresh tokens in Mongo, everything else in Postgres.** Rejected for the
  same cross-database-transaction reason, narrowed to login: issuing the
  first refresh token happens in the same request as reading the user's role
  from Postgres to mint the access token, and splitting the two engines for
  one table buys nothing specific to sessions while adding a second store to
  reason about for every login and refresh.

## Consequences

- A fork that keeps Postgres but swaps ORMs still models these three tables
  as ordinary relational tables with foreign keys; nothing about their shape
  is Drizzle-specific beyond what
  [the fork seam](../architecture.md#fork-seam) already documents for
  `users`.
- `MongoModule` stays connected at boot with nothing in `identity` ever
  calling it.
- If a token table's row count ever becomes a concern, a scheduled deletion
  of rows past `expires_at` is a job to add later; nothing about this
  decision blocks it.
