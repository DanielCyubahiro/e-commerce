# 0009. Postgres owns `updated_at`

## Status

Accepted.

## Context

`updated_at` had two writers. `created_at` and the insert-time `updated_at`
both come from Postgres `now()`, at microsecond resolution, on the database's
clock. The `.$onUpdate(() => new Date())` hook on
[`products.schema.ts`](../../src/shared/infrastructure/database/postgres/schema/products.schema.ts)
supplied a millisecond-resolution JavaScript `Date` from the host process
instead. An application server whose clock lags the database's can persist an
`updated_at` earlier than its own row's `created_at`. The hook had also never
executed: nothing in `src/` or `test/` calls `.update(` yet, so this feature
would have been the first to activate it, and the first place the two-clock
anomaly could actually surface.

## Decision

A `BEFORE UPDATE ... FOR EACH ROW` trigger, `products_set_updated_at`, calls a
`set_updated_at()` function that sets `NEW.updated_at = now()`. Both live in
[`0002_updated_at_trigger.sql`](../../drizzle/0002_updated_at_trigger.sql),
hand-written because drizzle-kit generates no triggers. The `$onUpdate` hook
is removed from
[`products.schema.ts`](../../src/shared/infrastructure/database/postgres/schema/products.schema.ts);
the write adapter deliberately omits `updatedAt` from its `.set()` payload, so
the trigger is the only writer left. The trigger fires unconditionally,
without guarding on `OLD.* IS DISTINCT FROM NEW.*`: a write that happens to
carry values identical to the row's current ones still replaced the row's
state, and `updated_at` records that a write happened, not that a value
changed.

Only the write itself, arbitrated by the database, can guarantee the value,
because application code can be bypassed or buggy, the same reasoning
[ADR 0003](0003-sku-uniqueness-arbitrated-by-the-database.md) applies to SKU
uniqueness.

## Alternatives considered

- **Leave `$onUpdate` in place.** Rejected: two clocks stay live, and the skew
  is invisible until someone compares the two columns on a row where it
  happened to matter.
- **Have the adapter set `updatedAt: sql\`now()\`` on every write.** Rejected:
  a future write path that forgets the column leaves a stale timestamp with
  nothing structural to catch it, and a stale value is a worse wrong answer
  than a skewed one, since nothing about a stale timestamp looks abnormal.

## Consequences

- One clock owns both columns, so `updated_at > created_at` is reliably
  assertable after any update, which every later timestamp assertion depends
  on.
- [`products.schema.ts`](../../src/shared/infrastructure/database/postgres/schema/products.schema.ts)
  no longer fully describes the database: drizzle-kit neither generates nor
  drops the trigger, so reading the schema file alone hides that `updated_at`
  moves on update at all.
- A fork that keeps the `updated_at` column but omits the trigger, whether by
  forking the ORM or the database engine, leaves it frozen at insert time,
  with no error anywhere to surface the gap.
- [`0002_updated_at_trigger.sql`](../../drizzle/0002_updated_at_trigger.sql)
  uses `CREATE OR REPLACE TRIGGER`, which requires Postgres 14 or later; a
  fork onto an older Postgres must rewrite it as `DROP TRIGGER IF EXISTS`
  followed by `CREATE TRIGGER`.
