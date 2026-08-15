# 0003. The unique constraint arbitrates duplicate SKUs

## Status

Accepted.

## Context

Two concurrent callers can each ask "does this SKU already exist?", both get
"no", and both proceed to insert before either one has written anything. Any
check that runs in application code before the write cannot close that window
by itself; only the write itself, arbitrated by something that serialises
concurrent access to the same row, can. Postgres already enforces a unique
constraint on `sku` for data integrity; the decision is whether to also treat
a violation of it as the application's signal for a duplicate SKU, rather than
trying to prevent the collision earlier.

## Decision

`add` simply attempts the insert; a duplicate SKU is not pre-checked, it is
caught. `add`'s try/catch and the private `isDuplicateSku` check
(constants at
[`drizzle-product.write-repository.ts:14-15`](../../src/product/infrastructure/adapters/drizzle-product.write-repository.ts#L14-L15),
method at
[lines 49 to 78](../../src/product/infrastructure/adapters/drizzle-product.write-repository.ts#L49-L78))
translate SQLSTATE `23505` on constraint `products_sku_unique` into
[`DuplicateSkuException`](../../src/product/application/exceptions/duplicate-sku.exception.ts).
The check walks the caught error's cause chain in a loop rather than reading
`error.code` directly, because Drizzle wraps a driver failure in its own
`DrizzleQueryError`, so the underlying Postgres error, the object actually
carrying `code` and `constraint_name`, sits some number of levels down and
that depth is not guaranteed. Matching the constraint name alongside the code
is deliberate: `id`'s primary key is also backed by a unique index, so a bare
`23505` check alone could not tell a primary-key collision apart from a
duplicate SKU. Only a match on both raises `DuplicateSkuException`; anything
else, including a primary-key collision, rethrows unchanged.

## Alternatives considered

- **Read-then-write check.** Look up the SKU first and insert only if absent.
  Rejected: two concurrent callers can both finish the lookup before either
  inserts, so both see "no existing product" and both proceed; the collision
  still happens at the database, and the check itself bought nothing.
- **Advisory lock around the insert.** Rejected: heavier, an explicit lock to
  acquire and release around every insert, and it still could not replace the
  unique constraint, since a caller from another connection that skipped the
  lock, or a bug in the locking code, could still insert a duplicate without
  it. The constraint would still be needed as the actual guarantee.

## Consequences

- No race window: uniqueness is enforced by Postgres itself, not by
  application code that could be bypassed or buggy.
- The adapter has to walk a cause chain of unknown depth instead of reading
  `error.code` directly, because Drizzle wraps the driver error.
- The constraint name is matched alongside the code on purpose, so a
  primary-key collision is never misreported as a duplicate SKU.
- The constraint name (`products_sku_unique`) is now load-bearing outside the
  migration that created it. A future migration that renames it silently
  breaks `isDuplicateSku`, which then stops recognising the duplicate case and
  lets a raw driver error escape as a 500 instead of the intended 409. This
  exact coupling, and what a forked adapter has to preserve to keep it working,
  is documented in [the fork seam](../architecture.md#fork-seam).
