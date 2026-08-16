# 0002. Queries project rows; they never rehydrate the aggregate

## Status

Accepted.

## Context

A query like "list products" needs to display stored data; it never mutates
anything and has no invariant to protect. If the read path reconstructed a
`Product` for every row instead, the aggregate would need a way to be built
from storage that skips the validation a fresh `Product` goes through, and
every query would pay for machinery it has no use for. See
[Aggregate](../concepts.md#aggregate) for what `Product` guarantees on the
write side, and [Query](../concepts.md#query) for what a query is understood
to do in this codebase.

## Decision

Commands operate on the `Product` aggregate; `Product.create` stays the only
way to construct one. Queries return a flat
[`ProductReadModel`](../../src/product/application/read-models/product.read-model.ts)
instead, and never rebuild a `Product` from a row. The read model's own comment
states the consequence directly: nothing on the query path enforces an
invariant, which is what lets `Product`'s constructor stay private (see
[`ProductReadModel`](../../src/product/application/read-models/product.read-model.ts)).
Because no query needs a way to reconstruct a `Product` from stored data, the
aggregate never has to expose one, and its persistence factory (were one ever
added) would not need to be public either.

## Alternatives considered

- **Rehydrate a `Product` for every read.** Every query would then depend on
  the aggregate's invariant-checking logic for data that was already valid
  when it was written, and the aggregate would have to expose a public,
  non-validating way to construct a `Product` from a row, widening its
  interface for a path that protects nothing.
- **Separate databases for reads and writes.** Closer to what CQRS describes
  structurally, but unneeded machinery at this scale: both repositories
  already read and write the same `products` table, so a second database would
  add a second connection and a synchronisation problem without solving a
  consistency issue that exists today.

## Consequences

- The application layer defines two ports rather than one,
  [`ProductWriteRepository`](../../src/product/application/ports/product.write-repository.ts)
  and
  [`ProductReadRepository`](../../src/product/application/ports/product.read-repository.ts).
- The read model must be re-projected by hand whenever a column is added;
  there is no single mapping shared with the write side that updates both
  automatically.
- There is no eventual consistency to reason about. Both the read and write
  repositories hit the same table, so a query issued right after a command
  sees that command's effect immediately.
