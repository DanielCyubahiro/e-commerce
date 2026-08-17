# 0007. Deleting a product removes the row

## Status

Accepted.

## Context

A catalogue needs a way to remove a product. The simplest choice, actually
removing the row, is also the one most systems avoid by reflex, usually
because something else still needs to refer to the deleted thing after the
fact, an order or a cart holding on to a product id. This catalogue, as it
stands today, has no such referent: nothing in the codebase points at a
`Product` by id and expects it to still resolve after deletion.

## Decision

[`DrizzleProductWriteRepository.delete`](../../src/product/infrastructure/adapters/drizzle-product.write-repository.ts)
issues a real `DELETE`, removing the row outright, and returns whether
anything was actually removed, so a caller can distinguish "deleted" from
"there was nothing to delete" without a separate existence check.

## Alternatives considered

- **A `deleted_at` column, "soft delete".** Rejected: every read path would
  then have to remember to filter rows with a set `deleted_at`, and forgetting
  even once, in one query, leaks a deleted row back into results as if it
  still existed. That filter would have to be carried on every query forever,
  for a case a hard delete makes structurally impossible to forget.
- **An archive table**, moving a deleted row elsewhere instead of discarding
  it. Rejected: more machinery, a second table and an atomic move-and-delete
  step, than a catalogue with nothing referencing its rows needs. The benefit
  an archive buys, recovering or inspecting a deleted row later, has no
  current use case asking for it.

## Consequences

- Reads stay simple: there is no `deleted_at` filter to add to every query and
  no way to forget it, because there is nothing to filter.
- Deletion is irreversible. Once a row is gone there is no path back to it
  inside the database.
- This decision is scoped to a catalogue that nothing else references, and
  must be revisited when orders or carts reference products, since deleting a
  product an order still points at would break referential integrity. At that
  point the tradeoff this ADR made changes, because there would then be a
  referent a hard delete could silently orphan.
